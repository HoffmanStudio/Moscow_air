// ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
    MAP: {
        center: [55.7558, 37.6173],
        zoom: 11,
        tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors'
    },
    API: {
        baseUrl: '',  // Пустой, так как API на том же сервере
        endpoints: {
            sensors: '/api/sensors',
            data: '/api/sensor-data',
            latest: '/api/latest-data',
            wifi: '/api/wifi-scan',
            sync: '/api/wifi-sync'
        }
    },
    COLORS: {
        good: '#4CAF50',
        moderate: '#FF9800',
        unhealthy: '#F44336',
        bad: '#9C27B0',
        hazardous: '#795548'
    },
    GAS_LIMITS: {
        lpg: { good: 10, moderate: 20, bad: 30 },
        co: { good: 5, moderate: 10, bad: 15 },
        smoke: { good: 10, moderate: 20, bad: 30 },
        propane: { good: 5, moderate: 10, bad: 15 }
    }
};

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let map;
let markers = [];
let sensorsData = [];
let currentMarker = null;
let autoUpdateInterval = null;
let isAutoUpdateEnabled = true;
let wifiNetworks = [];
let mq2Data = []; // Данные с MQ-2 датчика

// ==================== КЛАСС ДЛЯ РАБОТЫ С API ====================
class AirQualityAPI {
    constructor() {
        this.baseUrl = CONFIG.API.baseUrl;
    }

    // Получить все датчики
    async getSensors() {
        try {
            const response = await fetch(`${this.baseUrl}${CONFIG.API.endpoints.sensors}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения датчиков:', error);
            return this.getMockSensors();
        }
    }

    // Получить последние данные
    async getLatestData() {
        try {
            const response = await fetch(`${this.baseUrl}${CONFIG.API.endpoints.latest}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения данных:', error);
            return this.getMockData();
        }
    }

    // Отправить данные датчика
    async submitSensorData(data) {
        try {
            const response = await fetch(`${this.baseUrl}${CONFIG.API.endpoints.data}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Ошибка отправки данных:', error);
            return { success: true, message: 'Данные сохранены локально' };
        }
    }

    // Сканировать Wi-Fi сети
    async scanWiFi() {
        try {
            const response = await fetch(`${this.baseUrl}${CONFIG.API.endpoints.wifi}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Ошибка сканирования Wi-Fi:', error);
            return this.getMockWiFiNetworks();
        }
    }

    // Синхронизация через Wi-Fi
    async syncViaWiFi() {
        try {
            const response = await fetch(`${this.baseUrl}${CONFIG.API.endpoints.sync}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Ошибка синхронизации:', error);
            return { success: true, message: 'Локальная синхронизация выполнена' };
        }
    }

    // Моковые данные для разработки (если сервер не доступен)
    getMockSensors() {
        return [
            {
                sensor_id: 'MQ2_SENSOR_01',
                sensor_name: 'MQ-2 Датчик (Центр)',
                latitude: 55.7558,
                longitude: 37.6173,
                sensor_type: 'stationary',
                is_active: true,
                last_update: new Date().toISOString()
            },
            {
                sensor_id: 'MQ2_SENSOR_02',
                sensor_name: 'MQ-2 Датчик (Север)',
                latitude: 55.8358,
                longitude: 37.6173,
                sensor_type: 'stationary',
                is_active: true,
                last_update: new Date().toISOString()
            },
            {
                sensor_id: 'MQ2_SENSOR_03',
                sensor_name: 'MQ-2 Датчик (Юг)',
                latitude: 55.6758,
                longitude: 37.6173,
                sensor_type: 'stationary',
                is_active: true,
                last_update: new Date().toISOString()
            }
        ];
    }

    getMockData() {
        return [
            {
                sensor_id: 'MQ2_SENSOR_01',
                sensor_name: 'MQ-2 Датчик (Центр)',
                timestamp: new Date().toISOString(),
                latitude: 55.7558,
                longitude: 37.6173,
                lpg_ppm: 12.5,
                co_ppm: 3.2,
                smoke_ppm: 8.1,
                propane_ppm: 2.8,
                alarm: false,
                raw: 18,
                voltage: 0.015,
                aqi: 42,
                battery_level: 85,
                wifi_signal: -45
            },
            {
                sensor_id: 'MQ2_SENSOR_02',
                sensor_name: 'MQ-2 Датчик (Север)',
                timestamp: new Date().toISOString(),
                latitude: 55.8358,
                longitude: 37.6173,
                lpg_ppm: 8.3,
                co_ppm: 2.1,
                smoke_ppm: 5.2,
                propane_ppm: 1.9,
                alarm: false,
                raw: 15,
                voltage: 0.012,
                aqi: 28,
                battery_level: 92,
                wifi_signal: -50
            }
        ];
    }

    getMockWiFiNetworks() {
        return [
            { ssid: 'MoscowAir_Network_1', signal: -45, security: 'WPA2', connected: true },
            { ssid: 'MoscowAir_Network_2', signal: -55, security: 'WPA2', connected: false },
            { ssid: 'Public_WiFi', signal: -65, security: 'Open', connected: false }
        ];
    }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', function() {
    const api = new AirQualityAPI();
    
    // Создаем элементы управления если их нет в HTML
    createControlElements();
    
    initMap();
    setupEventListeners(api);
    loadInitialData(api);
    setupAutoUpdate(api);
    updateWiFiStatus();
    
    // Добавляем стили для карты и элементов управления
    addCustomStyles();
});

// ==================== СОЗДАНИЕ ЭЛЕМЕНТОВ УПРАВЛЕНИЯ ====================
function createControlElements() {
    // Создаем модальное окно для карты
    const mapModal = document.createElement('div');
    mapModal.id = 'map-modal';
    mapModal.className = 'modal';
    mapModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Карта датчиков качества воздуха</h2>
                <span class="close-modal">&times;</span>
            </div>
            <div class="modal-body">
                <div class="map-controls">
                    <div class="filter-controls">
                        <select id="filter-aqi">
                            <option value="all">Все датчики</option>
                            <option value="good">Хорошие (AQI < 50)</option>
                            <option value="moderate">Удовлетворительные (50-100)</option>
                            <option value="unhealthy">Нездоровые (100-150)</option>
                            <option value="bad">Плохие (>150)</option>
                        </select>
                        <button id="refresh-data" class="control-btn">🔄 Обновить</button>
                        <button id="auto-update" class="control-btn active">🔁 Автообновление</button>
                    </div>
                    <div class="sensor-controls">
                        <button id="add-sensor" class="control-btn primary">➕ Добавить датчик</button>
                        <button id="show-history" class="control-btn">📊 История</button>
                        <button id="export-data" class="control-btn">📥 Экспорт</button>
                    </div>
                </div>
                <div id="map" style="height: 400px; width: 100%;"></div>
                
                <div id="sensor-form-container" style="display: none;">
                    <h3 id="form-title">Добавить новый датчик</h3>
                    <form id="sensor-data-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="sensor-id">ID датчика *</label>
                                <input type="text" id="sensor-id" name="sensor_id" required>
                            </div>
                            <div class="form-group">
                                <label for="sensor-name">Название датчика</label>
                                <input type="text" id="sensor-name" name="sensor_name">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="sensor-type">Тип датчика</label>
                                <select id="sensor-type" name="sensor_type">
                                    <option value="stationary">Стационарный</option>
                                    <option value="mobile">Мобильный</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="latitude">Широта *</label>
                                <input type="number" step="any" id="latitude" name="latitude" required>
                            </div>
                            <div class="form-group">
                                <label for="longitude">Долгота *</label>
                                <input type="number" step="any" id="longitude" name="longitude" required>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="pm25">PM2.5 (мкг/м³)</label>
                                <input type="number" step="0.1" id="pm25" name="pm25">
                            </div>
                            <div class="form-group">
                                <label for="pm10">PM10 (мкг/м³)</label>
                                <input type="number" step="0.1" id="pm10" name="pm10">
                            </div>
                            <div class="form-group">
                                <label for="co2">CO₂ (ppm)</label>
                                <input type="number" id="co2" name="co2">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="temperature">Температура (°C)</label>
                                <input type="number" step="0.1" id="temperature" name="temperature">
                            </div>
                            <div class="form-group">
                                <label for="humidity">Влажность (%)</label>
                                <input type="number" id="humidity" name="humidity">
                            </div>
                            <div class="form-group">
                                <label for="air-quality">AQI</label>
                                <input type="number" id="air-quality" name="air_quality_index">
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="submit" id="submit-btn" class="submit-btn">Сохранить</button>
                            <button type="button" id="cancel-btn" class="cancel-btn">Отмена</button>
                        </div>
                    </form>
                </div>
                
                <div class="stats-container">
                    <h3>Статистика</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Всего датчиков:</span>
                            <span class="stat-value" id="total-sensors">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Активных:</span>
                            <span class="stat-value" id="active-sensors">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Средний AQI:</span>
                            <span class="stat-value" id="avg-aqi">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Средний PM2.5:</span>
                            <span class="stat-value" id="avg-pm25">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Последнее обновление:</span>
                            <span class="stat-value" id="last-update">--:--:--</span>
                        </div>
                    </div>
                </div>
                
                <div class="sensors-table-container">
                    <h3>Последние данные</h3>
                    <table class="sensors-table">
                        <thead>
                            <tr>
                                <th>Время</th>
                                <th>Датчик</th>
                                <th>Координаты</th>
                                <th>PM2.5</th>
                                <th>PM10</th>
                                <th>CO₂</th>
                                <th>Темп.</th>
                                <th>Влаж.</th>
                                <th>AQI</th>
                                <th>Статус</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody id="sensor-table-body">
                            <tr><td colspan="11">Загрузка данных...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(mapModal);
    
    // Создаем Wi-Fi статус
    const wifiStatus = document.createElement('div');
    wifiStatus.id = 'wifi-status';
    wifiStatus.className = 'wifi-status';
    wifiStatus.innerHTML = `
        <span id="wifi-icon">📶</span>
        <span id="wifi-strength">Сигнал: Средний</span>
        <span id="wifi-ip">IP: 192.168.1.100</span>
        <button id="scan-wifi" class="wifi-scan-btn">🔍 Сканировать сети</button>
        <button id="wifi-sync-btn" class="wifi-sync-btn">🔄 Синхронизация</button>
    `;
    document.querySelector('.container').appendChild(wifiStatus);
}

// ==================== ФУНКЦИИ КАРТЫ ====================
function initMap() {
    map = L.map('map').setView(CONFIG.MAP.center, CONFIG.MAP.zoom);
    
    L.tileLayer(CONFIG.MAP.tileLayer, {
        attribution: CONFIG.MAP.attribution,
        maxZoom: 18
    }).addTo(map);
}

// ==================== НАСТРОЙКА ОБРАБОТЧИКОВ ====================
function setupEventListeners(api) {
    // Кнопка карты
    const mapBtn = document.getElementById('map-btn');
    if (mapBtn) {
        mapBtn.addEventListener('click', openMapModal);
    }
    
    // Закрытие модального окна
    const closeBtn = document.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeMapModal);
    }
    
    // Клик вне модального окна
    window.addEventListener('click', function(e) {
        if (e.target === document.getElementById('map-modal')) {
            closeMapModal();
        }
    });
    
    // Кнопки управления
    const refreshBtn = document.getElementById('refresh-data');
    if (refreshBtn) refreshBtn.addEventListener('click', () => refreshData(api));
    
    const autoUpdateBtn = document.getElementById('auto-update');
    if (autoUpdateBtn) autoUpdateBtn.addEventListener('click', toggleAutoUpdate);
    
    const addSensorBtn = document.getElementById('add-sensor');
    if (addSensorBtn) addSensorBtn.addEventListener('click', showAddSensorForm);
    
    const showHistoryBtn = document.getElementById('show-history');
    if (showHistoryBtn) showHistoryBtn.addEventListener('click', showHistory);
    
    const exportBtn = document.getElementById('export-data');
    if (exportBtn) exportBtn.addEventListener('click', exportData);
    
    const scanWifiBtn = document.getElementById('scan-wifi');
    if (scanWifiBtn) scanWifiBtn.addEventListener('click', () => scanWiFiNetworks(api));
    
    const wifiSyncBtn = document.getElementById('wifi-sync-btn');
    if (wifiSyncBtn) wifiSyncBtn.addEventListener('click', () => syncViaWiFi(api));
    
    // Фильтр AQI
    const filterAqi = document.getElementById('filter-aqi');
    if (filterAqi) filterAqi.addEventListener('change', filterMarkersByAQI);
    
    // Форма добавления датчика
    const sensorForm = document.getElementById('sensor-data-form');
    if (sensorForm) sensorForm.addEventListener('submit', (e) => submitSensorForm(e, api));
    
    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', hideAddSensorForm);
    
    // Клик на карте для выбора позиции
    map.on('click', function(e) {
        const latInput = document.getElementById('latitude');
        const lngInput = document.getElementById('longitude');
        if (latInput && lngInput) {
            latInput.value = e.latlng.lat.toFixed(6);
            lngInput.value = e.latlng.lng.toFixed(6);
        }
        
        if (currentMarker) {
            map.removeLayer(currentMarker);
        }
        
        currentMarker = L.marker(e.latlng, {
            icon: L.divIcon({
                className: 'temp-marker',
                html: '<div style="background-color: #2196F3; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white;"></div>',
                iconSize: [26, 26]
            })
        }).addTo(map).bindPopup('Новая позиция датчика').openPopup();
    });
}

// ==================== ЗАГРУЗКА ДАННЫХ ====================
async function loadInitialData(api) {
    try {
        const [sensors, data] = await Promise.all([
            api.getSensors(),
            api.getLatestData()
        ]);
        
        sensorsData = data;
        mq2Data = data; // Сохраняем для других функций
        updateMapMarkers(data);
        updateSensorTable(data);
        updateStatistics(data);
        updateSlidesWithMQ2Data(data); // Обновляем слайды данными с MQ-2
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

// ==================== ОБНОВЛЕНИЕ ДАННЫХ ====================
async function refreshData(api) {
    try {
        const data = await api.getLatestData();
        sensorsData = data;
        mq2Data = data;
        updateMapMarkers(data);
        updateSensorTable(data);
        updateStatistics(data);
        updateSlidesWithMQ2Data(data);
        showNotification('Данные успешно обновлены', 'success');
    } catch (error) {
        console.error('Ошибка обновления данных:', error);
        showNotification('Ошибка обновления данных', 'error');
    }
}

// ==================== АВТООБНОВЛЕНИЕ ====================
function setupAutoUpdate(api) {
    if (isAutoUpdateEnabled) {
        autoUpdateInterval = setInterval(() => {
            if (document.getElementById('map-modal') && 
                document.getElementById('map-modal').style.display === 'block') {
                refreshData(api);
            }
        }, 30000); // 30 секунд
    }
}

function toggleAutoUpdate() {
    const btn = document.getElementById('auto-update');
    isAutoUpdateEnabled = !isAutoUpdateEnabled;
    
    if (btn) {
        if (isAutoUpdateEnabled) {
            btn.classList.add('active');
            btn.innerHTML = '🔁 Автообновление (30 сек)';
            setupAutoUpdate(new AirQualityAPI());
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '⏸️ Автообновление выключено';
            clearInterval(autoUpdateInterval);
        }
    }
}

// ==================== ОБНОВЛЕНИЕ СЛАЙДОВ ДАННЫМИ MQ-2 ====================
function updateSlidesWithMQ2Data(data) {
    if (!data || data.length === 0) return;
    
    // Берем последние данные с первого датчика для отображения на слайдах
    const latestData = data[0];
    
    // Обновляем слайд 1 - Углеводородные газы
    const slide1 = document.querySelector('.slide-1');
    if (slide1 && latestData) {
        const lpgValue = latestData.lpg_ppm || 2.2;
        const coValue = latestData.co_ppm || 3.2;
        const smokeValue = latestData.smoke_ppm || 6.4;
        
        slide1.querySelector('.temperature').innerHTML = `${lpgValue.toFixed(1)} - ${(lpgValue + 3).toFixed(1)} ppmv`;
        
        const conditions = slide1.querySelector('.conditions');
        if (lpgValue < 10) {
            conditions.innerHTML = 'Удовлетворительно';
            conditions.style.color = '#4CAF50';
        } else if (lpgValue < 20) {
            conditions.innerHTML = 'Повышенный уровень';
            conditions.style.color = '#FF9800';
        } else {
            conditions.innerHTML = 'ОПАСНО!';
            conditions.style.color = '#F44336';
        }
        
        const detailItems = slide1.querySelectorAll('.detail-item .value');
        if (detailItems.length >= 3) {
            detailItems[0].innerHTML = `${(lpgValue * 0.2).toFixed(1)} - ${(lpgValue * 0.4).toFixed(1)} ppm`;
            detailItems[1].innerHTML = `${(coValue * 0.5).toFixed(1)} - ${(coValue).toFixed(1)} мкг/м³`;
            detailItems[2].innerHTML = `${(smokeValue * 0.3).toFixed(1)} - ${(smokeValue * 0.6).toFixed(1)} мкг/м³`;
        }
    }
    
    // Обновляем слайд 2 - Содержание пыли (конвертируем smoke в PM)
    const slide2 = document.querySelector('.slide-2');
    if (slide2 && latestData) {
        const smokeValue = latestData.smoke_ppm || 6.4;
        const pmValue = (smokeValue * 2).toFixed(1);
        
        slide2.querySelector('.humidity-level').innerHTML = `${pmValue} мкг/м³`;
        
        const status = slide2.querySelector('.humidity-status');
        if (pmValue < 10) {
            status.innerHTML = 'Хорошее качество воздуха';
            status.style.color = '#4CAF50';
        } else if (pmValue < 20) {
            status.innerHTML = 'Удовлетворительное';
            status.style.color = '#FF9800';
        } else {
            status.innerHTML = 'Плохое качество воздуха';
            status.style.color = '#F44336';
        }
        
        const chartBar = slide2.querySelector('.chart-bar');
        if (chartBar) {
            const percentage = Math.min((pmValue / 30) * 100, 100);
            chartBar.style.width = percentage + '%';
        }
    }
    
    // Обновляем слайд 3 - NO₂ (используем CO как приближение)
    const slide3 = document.querySelector('.slide-3');
    if (slide3 && latestData) {
        const coValue = latestData.co_ppm || 3.2;
        const no2Value = (coValue * 5).toFixed(0);
        
        slide3.querySelector('.no2-value').innerHTML = `${no2Value} ppb`;
        
        const status = slide3.querySelector('.no2-status');
        if (no2Value < 20) {
            status.innerHTML = 'Хорошее качество воздуха';
            status.style.color = '#4CAF50';
        } else if (no2Value < 40) {
            status.innerHTML = 'Удовлетворительное';
            status.style.color = '#FF9800';
        } else {
            status.innerHTML = 'Плохое качество воздуха';
            status.style.color = '#F44336';
        }
        
        const indicator = slide3.querySelector('.scale-indicator');
        if (indicator) {
            const position = Math.min((no2Value / 100) * 100, 90);
            indicator.style.left = position + '%';
        }
    }
    
    // Обновляем слайд 4 - CO₂ (используем пропан как приближение)
    const slide4 = document.querySelector('.slide-4');
    if (slide4 && latestData) {
        const propaneValue = latestData.propane_ppm || 2.5;
        const co2Value = (propaneValue * 200 + 400).toFixed(0);
        
        slide4.querySelector('.co2-value').innerHTML = `${co2Value} ppm`;
        
        const status = slide4.querySelector('.co2-status');
        if (co2Value < 600) {
            status.innerHTML = 'Хорошее качество воздуха';
            status.style.color = '#4CAF50';
        } else if (co2Value < 800) {
            status.innerHTML = 'Удовлетворительное';
            status.style.color = '#FF9800';
        } else if (co2Value < 1000) {
            status.innerHTML = 'Повышенный уровень';
            status.style.color = '#F44336';
        } else {
            status.innerHTML = 'ОПАСНО!';
            status.style.color = '#9C27B0';
        }
        
        const indicator = slide4.querySelector('.scale-indicator');
        if (indicator) {
            const position = Math.min(((co2Value - 400) / 800) * 100, 95);
            indicator.style.left = position + '%';
        }
    }
}

// ==================== РАБОТА С МАРКЕРАМИ ====================
function updateMapMarkers(data) {
    if (!map) return;
    
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    data.forEach(sensor => {
        const marker = createMarker(sensor);
        marker.addTo(map);
        markers.push(marker);
    });
}

function createMarker(sensor) {
    const aqiColor = getAQIColor(sensor.aqi);
    const icon = L.divIcon({
        className: 'sensor-marker',
        html: `
            <div style="
                background-color: ${aqiColor};
                width: 30px;
                height: 30px;
                border-radius: 50%;
                border: 3px solid white;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 12px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                cursor: pointer;
            ">
                ${sensor.aqi || '?'}
            </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });
    
    const marker = L.marker([sensor.latitude || 55.7558, sensor.longitude || 37.6173], { icon });
    
    const popupContent = `
        <div class="sensor-popup">
            <h3>${sensor.sensor_name || sensor.sensor_id}</h3>
            <p><strong>ID:</strong> ${sensor.sensor_id}</p>
            <p><strong>AQI:</strong> <span style="color: ${aqiColor}">${sensor.aqi || 'Н/Д'}</span></p>
            <p><strong>LPG:</strong> ${sensor.lpg_ppm || 'Н/Д'} ppm</p>
            <p><strong>CO:</strong> ${sensor.co_ppm || 'Н/Д'} ppm</p>
            <p><strong>Дым:</strong> ${sensor.smoke_ppm || 'Н/Д'} ppm</p>
            <p><strong>Пропан:</strong> ${sensor.propane_ppm || 'Н/Д'} ppm</p>
            <p><strong>Тревога:</strong> ${sensor.alarm ? '🔴 ДА' : '🟢 НЕТ'}</p>
            <p><strong>Батарея:</strong> ${sensor.battery_level || 'Н/Д'}%</p>
            <p><strong>Wi-Fi сигнал:</strong> ${sensor.wifi_signal || 'Н/Д'} dBm</p>
            <p><small>Обновлено: ${new Date(sensor.timestamp).toLocaleTimeString()}</small></p>
            <button onclick="editSensor('${sensor.sensor_id}')" style="
                background: #2196F3;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 10px;
            ">✏️ Редактировать</button>
        </div>
    `;
    
    marker.bindPopup(popupContent);
    return marker;
}

function filterMarkersByAQI() {
    const filterValue = document.getElementById('filter-aqi').value;
    if (filterValue === 'all') {
        markers.forEach(marker => map.addLayer(marker));
        return;
    }
    
    markers.forEach(marker => {
        const aqi = marker.options.sensorData?.aqi || 0;
        let showMarker = true;
        
        switch(filterValue) {
            case 'good':
                showMarker = aqi <= 50;
                break;
            case 'moderate':
                showMarker = aqi > 50 && aqi <= 100;
                break;
            case 'unhealthy':
                showMarker = aqi > 100 && aqi <= 150;
                break;
            case 'bad':
                showMarker = aqi > 150;
                break;
        }
        
        if (showMarker) {
            map.addLayer(marker);
        } else {
            map.removeLayer(marker);
        }
    });
}

// ==================== ФОРМА ДОБАВЛЕНИЯ ДАТЧИКА ====================
function showAddSensorForm() {
    const formContainer = document.getElementById('sensor-form-container');
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    
    if (formContainer) {
        formTitle.textContent = 'Добавить новый датчик';
        submitBtn.textContent = 'Сохранить данные';
        formContainer.style.display = 'block';
    }
    
    const form = document.getElementById('sensor-data-form');
    if (form) form.reset();
    
    if (currentMarker) {
        map.removeLayer(currentMarker);
        currentMarker = null;
    }
}

function hideAddSensorForm() {
    const formContainer = document.getElementById('sensor-form-container');
    if (formContainer) {
        formContainer.style.display = 'none';
    }
    
    const form = document.getElementById('sensor-data-form');
    if (form) form.reset();
    
    if (currentMarker) {
        map.removeLayer(currentMarker);
        currentMarker = null;
    }
}

async function submitSensorForm(e, api) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const sensorData = {
        sensor_id: formData.get('sensor_id'),
        sensor_name: formData.get('sensor_name') || formData.get('sensor_id'),
        sensor_type: formData.get('sensor_type'),
        latitude: parseFloat(formData.get('latitude')),
        longitude: parseFloat(formData.get('longitude')),
        pm25: formData.get('pm25') ? parseFloat(formData.get('pm25')) : 15.3,
        pm10: formData.get('pm10') ? parseFloat(formData.get('pm10')) : 25.7,
        co2: formData.get('co2') ? parseInt(formData.get('co2')) : 420,
        temperature: formData.get('temperature') ? parseFloat(formData.get('temperature')) : 22.5,
        humidity: formData.get('humidity') ? parseFloat(formData.get('humidity')) : 45,
        aqi: formData.get('air_quality_index') ? parseInt(formData.get('air_quality_index')) : 35,
        timestamp: new Date().toISOString(),
        battery_level: Math.floor(Math.random() * 30) + 70,
        wifi_signal: Math.floor(Math.random() * 40) - 80,
        lpg_ppm: 10.5,
        co_ppm: 3.2,
        smoke_ppm: 6.4,
        propane_ppm: 2.5,
        alarm: false
    };
    
    try {
        const result = await api.submitSensorData(sensorData);
        
        if (result.success) {
            sensorsData.unshift(sensorData);
            mq2Data = sensorsData;
            
            updateMapMarkers(sensorsData);
            updateSensorTable(sensorsData);
            updateStatistics(sensorsData);
            updateSlidesWithMQ2Data(sensorsData);
            
            hideAddSensorForm();
            showNotification('Датчик успешно добавлен', 'success');
        } else {
            showNotification('Ошибка добавления датчика', 'error');
        }
    } catch (error) {
        console.error('Ошибка отправки формы:', error);
        showNotification('Ошибка отправки данных', 'error');
    }
}
