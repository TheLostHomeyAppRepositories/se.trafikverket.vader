'use strict';

const Homey = require('homey');
const Trafikverket = require('../../lib/tv_api.js');

class WeatherDriver extends Homey.Driver {

    async onInit() {
        this.log('Trafikverket weather driver has been initialized');

        this._registerFlows();
    }

    _registerFlows() {
        this.log('Registering flows');
        //Conditions
        const rainAmount = this.homey.flow.getConditionCard('rainAmount');
        rainAmount.registerRunListener(async (args, state) => {
            this.log(`[${args.device.getName()}] Condition 'rainAmount' triggered`);
            const rain = args.device.getCapabilityValue('measure_rain');
            this.log(`[${args.device.getName()}] - inverter.measure_rain: '${rain}'`);
            this.log(`[${args.device.getName()}] - parameter rain: '${args.rain}'`);

            if (rain > args.rain) {
                return true;
            } else {
                return false;
            }
        });

        const snowAmount = this.homey.flow.getConditionCard('snowAmount');
        snowAmount.registerRunListener(async (args, state) => {
            this.log(`[${args.device.getName()}] Condition 'snowAmount' triggered`);
            const snow = args.device.getCapabilityValue('measure_rain.snow');
            this.log(`[${args.device.getName()}] - inverter.measure_rain.snow: '${snow}'`);
            this.log(`[${args.device.getName()}] - parameter snow: '${args.snow}'`);

            if (snow > args.snow) {
                return true;
            } else {
                return false;
            }
        });

    }

    async onPair(session) {
        session.setHandler('settings', async (data) => {
            if (data.stationName) {
                this.log(`User wants to search for '${data.stationName}'`);
                this.stationName = data.stationName;
            } else {
                this.log('User decided to search for stations nearby Homeys location');
            }
            await session.showView('list_devices');
            return 'done';
        });

        session.setHandler('list_devices', async (data) => {
            var self = this;
            let devices = [];
            const TV = new Trafikverket({ token: Homey.env.API_KEY });

            if (self.stationName) {
                self.log(`Searching for a specific station by name '${self.stationName}'`);
                return TV.getWeatherStationsByName(self.stationName)
                    .then(function (response) {
                        //Reset station name
                        self.stationName = null;

                        if (response &&
                            response.RESPONSE &&
                            response.RESPONSE.RESULT[0] &&
                            response.RESPONSE.RESULT[0].WeatherMeasurepoint) {

                            response.RESPONSE.RESULT[0].WeatherMeasurepoint.forEach(station => {
                                devices.push({
                                    name: station.Name,
                                    data: {
                                        id: station.Id
                                    }
                                });
                            });
                        } else {
                            self.log('We didnt get any weather stations in response from the API');
                        }
                        return devices;
                    });
            } else {
                self.log(`Searching for stations nearby Homeys location`);
                return TV.getWeatherStationsByLocation(
                    self.homey.geolocation.getLatitude(),
                    self.homey.geolocation.getLongitude(),
                    '20000m').then(function (response) {

                        if (response &&
                            response.RESPONSE &&
                            response.RESPONSE.RESULT[0] &&
                            response.RESPONSE.RESULT[0].WeatherMeasurepoint) {

                            response.RESPONSE.RESULT[0].WeatherMeasurepoint.forEach(station => {
                                devices.push({
                                    name: station.Name,
                                    data: {
                                        id: station.Id
                                    }
                                });
                            });
                        } else {
                            self.log('We didnt get any weather stations in response from the API');
                        }
                        return devices;
                    });
            }
        });
    }

}
module.exports = WeatherDriver;