'use strict';

const Homey = require('homey');
const util = require('util');
const Trafikverket = require('../../lib/tv_api.js');

class WeatherDevice extends Homey.Device {

    onInit() {
        this.log(`Trafikverket weather station initiated, '${this.getName()}'`);

        this.pollIntervals = [];
        this.refresh_status_cloud = this.getSettings().refresh_status_cloud || 5;

        this.weather = {
            id: this.getData().id,
            name: this.getName(),
        };

        this.setupCapabilities();

        this.weather.api = new Trafikverket({ token: Homey.env.API_KEY });
        this.refreshWeatherSiteStatus();

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
        self.weather.api.on('api_error', error => {
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

    //New API use new id format, this is to be backwards compatible
    getStationId() {
        if (isNaN(this.weather.id)) {
            return this.weather.id.substring(11);
        } else {
            return this.weather.id;
        }
    }

    refreshWeatherSiteStatus() {
        let self = this;
        self.weather.api.getWeatherStationDetails(self.getStationId())
            .then(function (message) {
                //self.log(util.inspect(message, { showHidden: false, depth: null }));

                let observation = message.RESPONSE.RESULT[0].WeatherMeasurepoint[0].Observation;
            
                self._updateProperty('measure_temperature', observation.Air.Temperature.Value || 0);
                self._updateProperty('measure_humidity', observation.Air.RelativeHumidity.Value || 0);

                let windDirection = observation.Wind[0].Direction.Value || 0;
                let windDirectionText = self.homey.__(`wind.${degToCard(windDirection)}`);

                self._updateProperty('measure_wind_strength', observation.Wind[0].Speed.Value || 0);
                self._updateProperty('measure_gust_strength', observation.Aggregated30minutes.Wind.SpeedMax.Value || 0);
                self._updateProperty('measure_wind_angle', windDirection);
                self._updateProperty('wind_angle_text', windDirectionText);

                self._updateProperty('measure_rain', observation.Aggregated30minutes.Precipitation.RainSum.Value);
                self._updateProperty('measure_rain.snow', observation.Aggregated30minutes.Precipitation.SnowSum.Solid.Value);
                self._updateProperty('measure_rain.total', observation.Aggregated30minutes.Precipitation.TotalWaterEquivalent.Value);

                self.setSettings({
                    last_response: JSON.stringify(message.RESPONSE.RESULT[0].WeatherMeasurepoint[0], null, "  ")
                }).catch(err => {
                    self.error('Failed to update settings', err);
                });
            }).catch(reason => {
                self.error(reason);
            });
    }

    _initilializeTimers() {
        this.log('Adding timers');
        //Get updates from cloud
        this.pollIntervals.push(setInterval(() => {
            this.refreshWeatherSiteStatus();
        }, 1000 * 60 * this.refresh_status_cloud));
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
        this.weather = null;
    }

    onRenamed(name) {
        this.log(`Renaming Trafikverket weather station from '${this.weather.name}' to '${name}'`);
        this.weather.name = name;
    }

    async onSettings(oldSettings, newSettings, changedKeysArr) {
        let change = false;

        if (changedKeysArr.indexOf("refresh_status_cloud") > -1) {
            this.log('Refresh cloud value was change to:', newSettings.refresh_status_cloud);
            this.refresh_status_cloud = newSettings.refresh_status_cloud;
            change = true;
        }

        if (change) {
            this._reinitializeTimers();
        }
    }

}

function degToCard(value) { value = parseFloat(value); if (value <= 11.25) return 'N'; value -= 11.25; var allDirections = ['NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N']; var dIndex = parseInt(value/22.5); return allDirections[dIndex] ? allDirections[dIndex] : 'N'; }

module.exports = WeatherDevice;
