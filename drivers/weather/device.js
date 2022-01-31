'use strict';

const Homey = require('homey');
const Trafikverket = require('../../lib/tv_api.js');

class WeatherDevice extends Homey.Device {

    async onInit() {
        this.log(`Trafikverket weather station initiated, '${this.getName()}'`);

        this.pollIntervals = [];
        this.weatherImages = [];

        this.setupCapabilities();

        this.weatherApi = new Trafikverket({ token: Homey.env.API_KEY });
        this.refreshWeatherSiteStatus();
        this.initializeCameraImages();

        this._initilializeTimers();
        this._initializeEventListeners();
    }

    setupCapabilities() {
        this.log('Setting up capabilities');

        let capability = 'precipitation_type';
        if (this.hasCapability(capability)) {
            this.log(`Remove existing capability '${capability}'`);
            this.removeCapability(capability);
        }

        capability = 'measure_rain.snow';
        if (!this.hasCapability(capability)) {
            this.log(`Adding missing capability '${capability}'`);
            this.addCapability(capability);
        }
        capability = 'measure_rain.total';
        if (!this.hasCapability(capability)) {
            this.log(`Adding missing capability '${capability}'`);
            this.addCapability(capability);
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
                    self.weatherImages[camera.Id] = await self.homey.images.createImage();
                    self.weatherImages[camera.Id].setUrl(imageUrl);
                    await self.setCameraImage(camera.Id, camera.Name, self.weatherImages[camera.Id]);
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
        try {
            self.weatherImages.forEach(image => {
                image.update();
            });
        } catch (reason) {
            self.error(reason);            
        }
    }

    _initilializeTimers() {
        this.log('Adding timers');
        //Get updates from cloud
        this.pollIntervals.push(setInterval(() => {
            this.refreshWeatherSiteStatus();
        }, 1000 * 60 * this.getSetting('refresh_status_cloud')));
    }

    _deleteTimers() {
        //Kill interval object(s)
        this.log('Removing timers');
        this.pollIntervals.forEach(timer => {
            clearInterval(timer);
        });
    }

    _reinitializeTimers() {
        this._deleteTimers();
        this._initilializeTimers();
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
        this._deleteTimers();
        this.weatherApi = null;
    }

    async onSettings({ oldSettings, newSettings, changedKeys }) {
        let change = false;

        if (changedKeys.indexOf("refresh_status_cloud") > -1) {
            this.log('Refresh cloud value was change to:', newSettings.refresh_status_cloud);
            change = true;
        }

        if (change) {
            this._reinitializeTimers();
        }
    }

}

const getJSONValueSafely = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

function degToCard(value) { value = parseFloat(value); if (value <= 11.25) return 'N'; value -= 11.25; var allDirections = ['NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N']; var dIndex = parseInt(value / 22.5); return allDirections[dIndex] ? allDirections[dIndex] : 'N'; }

module.exports = WeatherDevice;
