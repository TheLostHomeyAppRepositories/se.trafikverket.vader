'use strict';

const Homey = require('homey');
const Trafikverket = require('../../lib/tv_api.js');

class WeatherDevice extends Homey.Device {

    async onInit() {
        this.log(`Trafikverket weather station initiated, '${this.getName()}'`);

        this.weatherImages = [];

        await this.setupCapabilities();

        this.weatherApi = new Trafikverket({ 
            token: Homey.env.API_KEY,
            device: this
        });

        this.refreshWeatherSiteStatus();
        this.initializeCameraImages();

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
        let self = this;
        self.weatherApi.on('api_error', error => {
            self.error('Houston we have a problem', error);

            let message = '';
            if (self.isError(error)) {
                message = error.stack;
            } else {
                try {
                    message = JSON.stringify(error, null, "  ");
                } catch (e) {
                    self.log('Failed to stringify object', e);
                    message = error.toString();
                }
            }

            let dateTime = new Date().toISOString();
            self.setSettings({ last_error: dateTime + '\n' + message })
                .catch(err => {
                    self.error('Failed to update settings', err);
                });
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

    initializeCameraImages() {
        let self = this;
        self.log('Initializing camera images');
        self.weatherApi.getImageURLForWeatherStation(self.getName())
            .then(async function (message) {
                const cameras = message.RESPONSE.RESULT[0].Camera;
                for (const camera of cameras) {
                    self.log(`Camera '${camera.Name}' for station '${self.getName()}'`);
                    let imageUrl = await self.createCameraImageURL(camera);
                    const image = await self.homey.images.createImage();
                    image.setUrl(imageUrl);
                    await self.setCameraImage(camera.Id, camera.Name, image);
                    self.weatherImages[camera.Id] = image;
                }
            }).catch(reason => {
                self.error(reason);
            });
    }

    refreshWeatherSiteStatus() {
        let self = this;
        self.weatherApi.getWeatherStationDetails(self.getData().id)
            .then(function (message) {
                let observation = message.RESPONSE.RESULT[0].WeatherMeasurepoint[0].Observation;

                self._updateProperty('measure_temperature', getJSONValueSafely(['Air', 'Temperature', 'Value'], observation) || 0);
                self._updateProperty('measure_temperature.surface', getJSONValueSafely(['Surface', 'Temperature', 'Value'], observation) || 0);
                self._updateProperty('measure_humidity', getJSONValueSafely(['Air', 'RelativeHumidity', 'Value'], observation) || 0);

                self._updateProperty('measure_wind_strength', getJSONValueSafely(['Wind', 0, 'Speed', 'Value'], observation) || 0);
                let windDirection = getJSONValueSafely(['Wind', 0, 'Direction', 'Value'], observation) || 0;
                self._updateProperty('measure_wind_angle', windDirection);
                let windDirectionText = self.homey.__(`wind.${degToCard(windDirection)}`);
                self._updateProperty('wind_angle_text', windDirectionText);

                self._updateProperty('measure_gust_strength', getJSONValueSafely(['Aggregated30minutes', 'Wind', 'SpeedMax', 'Value'], observation) || 0);
                self._updateProperty('measure_rain', getJSONValueSafely(['Aggregated30minutes', 'Precipitation', 'RainSum', 'Value'], observation) || 0);
                self._updateProperty('measure_rain.snow', getJSONValueSafely(['Aggregated30minutes', 'Precipitation', 'SnowSum', 'Solid', 'Value'], observation) || 0);
                self._updateProperty('measure_rain.total', getJSONValueSafely(['Aggregated30minutes', 'Precipitation', 'TotalWaterEquivalent', 'Value'], observation) || 0);

                self.setSettings({
                    last_response: JSON.stringify(message.RESPONSE.RESULT[0].WeatherMeasurepoint[0], null, "  ")
                }).catch(err => {
                    self.error('Failed to update settings', err);
                });
            }).catch(reason => {
                self.error(reason);
            });

        //Make sure the images are also refreshed, url never changes
        for (const image of self.weatherImages) {
            image.update()
                .catch(err => {
                    self.error('Failed to update camera image', err);
                });
        }
    }

    _initilializeTimers() {
        this.log('Adding timers');
        //Get updates from cloud
        this.homey.setInterval(() => {
            this.refreshWeatherSiteStatus();
        }, 1000 * 60 * this.getSetting('refresh_status_cloud'));
    }

    _updateProperty(key, value) {
        if (this.hasCapability(key)) {
            let oldValue = this.getCapabilityValue(key);
            if (oldValue !== null && oldValue != value) {
                this.setCapabilityValue(key, value);
            } else {
                this.setCapabilityValue(key, value);
            }
        }
    }

    onDeleted() {
        this.log(`Deleting Trafikverket weather station '${this.getName()}' from Homey.`);
        this.weatherApi = null;
    }

}

const getJSONValueSafely = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

function degToCard(value) { value = parseFloat(value); if (value <= 11.25) return 'N'; value -= 11.25; var allDirections = ['NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N']; var dIndex = parseInt(value / 22.5); return allDirections[dIndex] ? allDirections[dIndex] : 'N'; }

module.exports = WeatherDevice;
