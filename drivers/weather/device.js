'use strict';

const Homey = require('homey');
const Trafikverket = require('../../lib/tv_api.js');

const deviceClass = 'service';

class WeatherDevice extends Homey.Device {

    async onInit() {
        this.log(`Trafikverket weather station initiated, '${this.getName()}'`);

        // Change device class to service if not already
        if (this.getClass() !== deviceClass) {
            await this.setClass(deviceClass);
        }

        this.weatherImages = [];
        this._snowChanged = this.homey.flow.getDeviceTriggerCard('snowChanged');

        await this.setupCapabilities();

        this.api = new Trafikverket({
            token: Homey.env.API_KEY,
            device: this
        });

        await this.refreshWeatherSiteStatus();
        await this.initializeCameraImages();

        this._initilializeTimers();
        this._initializeEventListeners();
    }

    async setupCapabilities() {
        this.log('Setting up capabilities');

        //Add and remove capabilities as part of upgrading a device
        await this.addCapabilityHelper('measure_rain.snow');
        await this.addCapabilityHelper('measure_rain.total');
    }

    async removeCapabilityHelper(capability) {
        if (this.hasCapability(capability)) {
            try {
                this.logMessage(`Remove existing capability '${capability}'`);
                await this.removeCapability(capability);
            } catch (reason) {
                this.error(`Failed to removed capability '${capability}'`);
                this.error(reason);
            }
        }
    }

    async addCapabilityHelper(capability) {
        if (!this.hasCapability(capability)) {
            try {
                this.logMessage(`Adding missing capability '${capability}'`);
                await this.addCapability(capability);
            } catch (reason) {
                this.error(`Failed to add capability '${capability}'`);
                this.error(reason);
            }
        }
    }

    _initializeEventListeners() {
        this.api.on('api_error', async (error) => {
            this.error('API error occurred:', error);

            let message = '';
            if (this.isError(error)) {
                message = error.stack;
            } else {
                try {
                    message = JSON.stringify(error, null, "  ");
                } catch (e) {
                    this.log('Failed to stringify error object:', e);
                    message = error.toString();
                }
            }

            const dateTime = new Date().toISOString();
            try {
                await this.setSettings({ 
                    last_error: `${dateTime}\n${message}` 
                });
            } catch (settingsError) {
                this.error('Failed to update error settings:', settingsError);
            }
        });
    }

    isError(err) {
        return (err && err.stack && err.message);
    }

    async createCameraImageURL(camera) {
        if (camera.HasFullSizePhoto) {
            return `${camera.PhotoUrl}?type=fullsize`;
        } else {
            return camera.PhotoUrl;
        }
    }

    async initializeCameraImages() {
        this.log('Initializing camera images');
        
        try {
            const message = await this.api.getImageURLForWeatherStation(this.getName());
            const cameras = message.RESPONSE.RESULT[0].Camera;
            
            for (const camera of cameras) {
                this.log(`Camera '${camera.Name}' for station '${this.getName()}'`);
                
                try {
                    const imageUrl = await this.createCameraImageURL(camera);
                    const image = await this.homey.images.createImage();
                    image.setUrl(imageUrl);
                    await this.setCameraImage(camera.Id, camera.Name, image);
                    this.weatherImages[camera.Id] = image;
                } catch (error) {
                    this.error(`Failed to initialize camera '${camera.Name}':`, error);
                }
            }
        } catch (error) {
            this.error('Failed to initialize camera images:', error);
        }
    }

    async refreshWeatherSiteStatus() {
        try {
            const message = await this.api.getWeatherStationDetails(this.getData().id);
            const observation = message.RESPONSE.RESULT[0].WeatherMeasurepoint[0].Observation;

            // Update temperature measurements
            await this._updateProperty('measure_temperature', getJSONValueSafely(['Air', 'Temperature', 'Value'], observation) || 0);
            await this._updateProperty('measure_temperature.surface', getJSONValueSafely(['Surface', 'Temperature', 'Value'], observation) || 0);
            await this._updateProperty('measure_humidity', getJSONValueSafely(['Air', 'RelativeHumidity', 'Value'], observation) || 0);

            // Update wind measurements
            await this._updateProperty('measure_wind_strength', getJSONValueSafely(['Wind', 0, 'Speed', 'Value'], observation) || 0);
            const windDirection = getJSONValueSafely(['Wind', 0, 'Direction', 'Value'], observation) || 0;
            await this._updateProperty('measure_wind_angle', windDirection);
            const windDirectionText = this.homey.__(`wind.${degToCard(windDirection)}`);
            await this._updateProperty('wind_angle_text', windDirectionText);

            // Update precipitation and gust measurements
            await this._updateProperty('measure_gust_strength', getJSONValueSafely(['Aggregated30minutes', 'Wind', 'SpeedMax', 'Value'], observation) || 0);
            await this._updateProperty('measure_rain', getJSONValueSafely(['Aggregated30minutes', 'Precipitation', 'RainSum', 'Value'], observation) || 0);
            await this._updateProperty('measure_rain.snow', getJSONValueSafely(['Aggregated30minutes', 'Precipitation', 'SnowSum', 'Solid', 'Value'], observation) || 0);
            await this._updateProperty('measure_rain.total', getJSONValueSafely(['Aggregated30minutes', 'Precipitation', 'TotalWaterEquivalent', 'Value'], observation) || 0);

            // Update settings with last response
            try {
                await this.setSettings({
                    last_response: JSON.stringify(message.RESPONSE.RESULT[0].WeatherMeasurepoint[0], null, "  ")
                });
            } catch (error) {
                this.error('Failed to update settings:', error);
            }
        } catch (error) {
            this.error('Failed to refresh weather site status:', error);
        }

        // Refresh camera images (URL never changes)
        for (const image of this.weatherImages) {
            try {
                await image.update();
            } catch (error) {
                this.error('Failed to update camera image:', error);
            }
        }
    }

    _initilializeTimers() {
        this.log('Adding timers');
        //Get updates from cloud
        this.homey.setInterval(() => {
            this.refreshWeatherSiteStatus();
        }, 1000 * 60 * this.getSetting('refresh_status_cloud'));
    }

    async _updateProperty(key, value) {
        if (!this.hasCapability(key)) {
            return;
        }

        if (typeof value === 'undefined' || value === null) {
            this.log(`Value for capability '${key}' is 'undefined'`);
            return;
        }

        const oldValue = this.getCapabilityValue(key);
        
        try {
            if (oldValue !== null && oldValue !== value) {
                await this.setCapabilityValue(key, value);
                
                if (key === 'measure_rain.snow') {
                    const tokens = { snow: value };
                    try {
                        await this._snowChanged.trigger(this, tokens, {});
                    } catch (error) {
                        this.error('Failed to trigger snow changed event:', error);
                    }
                }
            } else {
                await this.setCapabilityValue(key, value);
            }
        } catch (error) {
            this.error(`Failed to update capability '${key}':`, error);
        }
    }

    onDeleted() {
        this.log(`Deleting Trafikverket weather station '${this.getName()}' from Homey.`);
        this.api = null;
    }

}

const getJSONValueSafely = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

function degToCard(value) { value = parseFloat(value); if (value <= 11.25) return 'N'; value -= 11.25; var allDirections = ['NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N']; var dIndex = parseInt(value / 22.5); return allDirections[dIndex] ? allDirections[dIndex] : 'N'; }

module.exports = WeatherDevice;
