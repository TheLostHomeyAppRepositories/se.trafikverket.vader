'use strict';

const Homey = require('homey');
const Trafikverket = require('../../lib/tv_api.js');
const enums = require('../../lib/enums.js');

class WeatherDevice extends Homey.Device {

    onInit() {
        this.log(`Trafikverket weather station initiated, '${this.getName()}'`);

        this.pollIntervals = [];
        this.refresh_status_cloud = this.getSettings().refresh_status_cloud || 5;

        this.weather = {
            id: this.getData().id,
            name: this.getName(),
        };

        this.weather.api = new Trafikverket({ token: Homey.env.API_KEY });
        this.refreshWeatherSiteStatus();

        this._initilializeTimers();
        this._initializeEventListeners();
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

    refreshWeatherSiteStatus() {
        let self = this;
        self.weather.api.getWeatherStationDetails(self.weather.id)
            .then(function (message) {
                let status = message.RESPONSE.RESULT[0].WeatherStation[0];
                self._updateProperty('measure_temperature', status.Measurement.Air.Temp);
                self._updateProperty('measure_humidity', status.Measurement.Air.RelativeHumidity);
                self._updateProperty('measure_wind_strength', status.Measurement.Wind.Force);
                self._updateProperty('measure_wind_angle', status.Measurement.Wind.Direction);
                self._updateProperty('wind_angle_text',
                    self.homey.__(enums.decodeWindDirection(status.Measurement.Wind.DirectionText)));
                self._updateProperty('measure_gust_strength', status.Measurement.Wind.ForceMax);
                self._updateProperty('measure_rain', status.Measurement.Precipitation.Amount || 0);
                self._updateProperty('precipitation_type',
                    self.homey.__(enums.decodePrecipitationName(status.Measurement.Precipitation.AmountName)));

                self.setSettings({
                    last_response: JSON.stringify(status, null, "  ")
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

module.exports = WeatherDevice;
