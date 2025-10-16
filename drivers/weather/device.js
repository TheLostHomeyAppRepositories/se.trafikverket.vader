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
        // Validate camera object and PhotoUrl
        if (!camera || !camera.PhotoUrl) {
            this.error('Invalid camera object or missing PhotoUrl:', camera);
            return null;
        }
        
        // Ensure PhotoUrl is a string
        const photoUrl = String(camera.PhotoUrl).trim();
        if (!photoUrl) {
            this.error('Empty PhotoUrl for camera:', camera);
            return null;
        }
        
        // Check if camera has full size photo capability
        if (camera.HasFullSizePhoto === true || camera.HasFullSizePhoto === 'true') {
            const fullSizeUrl = `${photoUrl}?type=fullsize`;
            this.log(`Using full size image URL for camera '${camera.Name}': ${fullSizeUrl}`);
            return fullSizeUrl;
        } else {
            this.log(`Using standard image URL for camera '${camera.Name}': ${photoUrl}`);
            return photoUrl;
        }
    }

    async initializeCameraImages() {
        this.log('Initializing camera images');
        
        try {
            const message = await this.api.getImageURLForWeatherStation(this.getName());
            
            // Validate API response structure
            if (!message || !message.RESPONSE || !message.RESPONSE.RESULT || !message.RESPONSE.RESULT[0]) {
                this.error('Invalid API response structure for camera images');
                return;
            }
            
            const cameras = message.RESPONSE.RESULT[0].Camera;
            
            // Validate cameras array
            if (!Array.isArray(cameras) || cameras.length === 0) {
                this.log('No cameras found for this weather station');
                return;
            }
            
            this.log(`Found ${cameras.length} camera(s) for station '${this.getName()}'`);
            
            // Process cameras sequentially to avoid race conditions
            for (const camera of cameras) {
                await this.initializeSingleCamera(camera);
            }
            
            this.log(`Successfully initialized ${Object.keys(this.weatherImages).length} camera image(s)`);
        } catch (error) {
            this.error('Failed to initialize camera images:', error);
            // Retry after a delay
            setTimeout(() => {
                this.log('Retrying camera image initialization...');
                this.initializeCameraImages();
            }, 30000); // Retry after 30 seconds
        }
    }

    async initializeSingleCamera(camera) {
        // Validate camera object
        if (!camera || !camera.Id || !camera.Name) {
            this.error('Invalid camera object:', camera);
            return;
        }
        
        this.log(`Initializing camera '${camera.Name}' (ID: ${camera.Id})`);
        
        try {
            const imageUrl = await this.createCameraImageURL(camera);
            
            if (!imageUrl) {
                this.error(`No image URL generated for camera '${camera.Name}'`);
                return;
            }
            
            this.log(`Creating image for camera '${camera.Name}' with URL: ${imageUrl}`);
            
            const image = await this.homey.images.createImage();
            image.setUrl(imageUrl);
            
            // Add error handling for setCameraImage
            try {
                await this.setCameraImage(camera.Id, camera.Name, image);
                this.weatherImages[camera.Id] = image;
                this.log(`Successfully initialized camera '${camera.Name}'`);
            } catch (setImageError) {
                this.error(`Failed to set camera image for '${camera.Name}':`, setImageError);
                // Clean up the created image if setCameraImage fails
                try {
                    await image.delete();
                } catch (deleteError) {
                    this.error(`Failed to delete image for camera '${camera.Name}':`, deleteError);
                }
            }
        } catch (error) {
            this.error(`Failed to initialize camera '${camera.Name}':`, error);
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
        if (this.weatherImages && Object.keys(this.weatherImages).length > 0) {
            this.log(`Refreshing ${Object.keys(this.weatherImages).length} camera image(s)`);
            
            for (const [cameraId, image] of Object.entries(this.weatherImages)) {
                try {
                    await image.update();
                    this.log(`Successfully updated camera image for ID: ${cameraId}`);
                } catch (error) {
                    this.error(`Failed to update camera image for ID ${cameraId}:`, error);
                    // Optionally remove failed images from the cache
                    delete this.weatherImages[cameraId];
                }
            }
        } else {
            this.log('No camera images to refresh');
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
                        await this.driver.triggerSnowChanged(this, tokens);
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

    async retryCameraImages() {
        this.log('Manually retrying camera image initialization...');
        this.weatherImages = []; // Clear existing images
        await this.initializeCameraImages();
    }

    onDeleted() {
        this.log(`Deleting Trafikverket weather station '${this.getName()}' from Homey.`);
        this.api = null;
    }

}

const getJSONValueSafely = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

function degToCard(value) { value = parseFloat(value); if (value <= 11.25) return 'N'; value -= 11.25; var allDirections = ['NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N']; var dIndex = parseInt(value / 22.5); return allDirections[dIndex] ? allDirections[dIndex] : 'N'; }

module.exports = WeatherDevice;
