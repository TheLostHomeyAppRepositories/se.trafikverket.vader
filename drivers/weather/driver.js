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

        this._snowChanged = this.homey.flow.getDeviceTriggerCard('snowChanged');

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

    async triggerSnowChanged(device, tokens) {
        await this._snowChanged.trigger(device, {}, tokens).catch(error => { this.error(error) });
    }

    async onPair(session) {
        session.setHandler('settings', async (data) => {
            if (data.stationName) {
                this.log(`User wants to search for '${data.stationName}'`);
                this.stationName = data.stationName;
            } else {
                this.log('User decided to search for stations nearby Homey location');
            }
            await session.showView('list_devices');
            return 'done';
        });

        session.setHandler('list_devices', async (data) => {
            const devices = [];
            const TV = new Trafikverket({ token: Homey.env.API_KEY });

            try {
                let response;

                if (this.stationName) {
                    this.log(`Searching for a specific station by name '${this.stationName}'`);
                    response = await TV.getWeatherStationsByName(this.stationName);
                    // Reset station name
                    this.stationName = null;
                } else {
                    this.log('Searching for stations nearby Homey location');
                    response = await TV.getWeatherStationsByLocation(
                        this.homey.geolocation.getLatitude(),
                        this.homey.geolocation.getLongitude(),
                        '20000m'
                    );
                }

                if (response?.RESPONSE?.RESULT?.[0]?.WeatherMeasurepoint) {
                    response.RESPONSE.RESULT[0].WeatherMeasurepoint.forEach(station => {
                        devices.push({
                            name: station.Name,
                            data: {
                                id: station.Id
                            }
                        });
                    });
                } else {
                    this.log('No weather stations received in API response');
                }

                return devices;
            } catch (error) {
                this.error('Failed to get weather stations:', error);
                return [];
            }
        });
    }

}
module.exports = WeatherDriver;