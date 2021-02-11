'use strict';

const http = require('http.min');
const EventEmitter = require('events');
const util = require('util');
const apiErrorEventName = 'api_error';

const apiProtocol = 'https:';
const apiDomain = 'api.trafikinfo.trafikverket.se';
const apiEndpoint = '/v2/data.json';
const apiTimeout = 5000;

function Trafikverket(options) {
    var self = this;
    EventEmitter.call(self);
    if (options == null) { options = {} };
    self.options = options;
}
util.inherits(Trafikverket, EventEmitter);

Trafikverket.prototype.getWeatherStationsByName = function (name) {
    var self = this;

    let xmlReq = `<REQUEST><LOGIN authenticationkey='${self.options.token}'/>` +
        `<QUERY objecttype='WeatherMeasurepoint' schemaversion='1'>` +
        '<FILTER>' +
        `<LIKE name='Name' value='^${name}' />` +
        '</FILTER>' +
        '<INCLUDE>Id</INCLUDE>' +
        '<INCLUDE>Name</INCLUDE>' +
        '<INCLUDE>Geometry.WGS84</INCLUDE>' +
        `</QUERY></REQUEST>`;

    return postCommand(xmlReq)
        .then(function (result) {
            return result;
        })
        .catch(reason => {
            self.emit(apiErrorEventName, reason);
            return Promise.reject(reason);
        });
}

Trafikverket.prototype.getWeatherStationsByLocation = function (lat, long, radius) {
    var self = this;

    let xmlReq = `<REQUEST><LOGIN authenticationkey='${self.options.token}'/>` +
        `<QUERY objecttype='WeatherMeasurepoint' schemaversion='1'>` +
        '<FILTER>' +
        `<WITHIN name='Geometry.WGS84' shape='center' value='${long} ${lat}' radius='${radius}' />` +
        '</FILTER>' +
        '<INCLUDE>Id</INCLUDE>' +
        '<INCLUDE>Name</INCLUDE>' +
        '<INCLUDE>Geometry.WGS84</INCLUDE>' +
        `</QUERY></REQUEST>`;

    return postCommand(xmlReq)
        .then(function (result) {
            return result;
        })
        .catch(reason => {
            self.emit(apiErrorEventName, reason);
            return Promise.reject(reason);
        });
}

Trafikverket.prototype.getWeatherStationDetails = function (stationId) {
    var self = this;

    let xmlReq = `<REQUEST><LOGIN authenticationkey='${self.options.token}'/>` +
        `<QUERY objecttype='WeatherMeasurepoint' schemaversion='1'>` +
        '<FILTER>' +
        `<EQ name='Id' value='${stationId}' />` +
        '</FILTER>' +
        '<INCLUDE>Id</INCLUDE>' +
        '<INCLUDE>Name</INCLUDE>' +
        '<INCLUDE>Geometry.WGS84</INCLUDE>' +
        '<INCLUDE>Observation.Air.Temperature.Value</INCLUDE>' +
        '<INCLUDE>Observation.Air.RelativeHumidity.Value</INCLUDE>' +
        '<INCLUDE>Observation.Aggregated30minutes.Precipitation.RainSum.Value</INCLUDE>' +
        '<INCLUDE>Observation.Aggregated30minutes.Precipitation.SnowSum.Solid.Value</INCLUDE>' +
        '<INCLUDE>Observation.Aggregated30minutes.Precipitation.TotalWaterEquivalent.Value</INCLUDE>' +
        '<INCLUDE>Observation.Wind.Direction.Value</INCLUDE>' +
        '<INCLUDE>Observation.Wind.Speed.Value</INCLUDE>' +
        '<INCLUDE>Observation.Aggregated30minutes.Wind.SpeedMax.Value</INCLUDE>' +
        '<INCLUDE>ModifiedTime</INCLUDE>' +
        `</QUERY></REQUEST>`;

    return postCommand(xmlReq)
        .then(function (result) {
            return result;
        })
        .catch(reason => {
            self.emit(apiErrorEventName, reason);
            return Promise.reject(reason);
        });
}

function postCommand(data) {

    let options = {
        timeout: apiTimeout,
        protocol: apiProtocol,
        hostname: apiDomain,
        path: apiEndpoint,
        headers: {
            'content-type': 'text/xml',
            'Accept': '*/*'
        }
    };

    return http.post(options, data)
        .then(function (result) {
            if (result.response.statusCode == 200) {
                try {
                    return JSON.parse(result.data);
                } catch (error) {
                    return result.data;
                }
            } else {
                let message;
                try {
                    message = util.inspect(result.data, { showHidden: false, depth: null });
                } catch (e) {
                    message = result.data;
                }
                return Promise.reject(new Error(`Command '${data}' failed, HTTP status code '${result.response.statusCode}', and message '${message}'`));
            }
        })
        .catch(reason => {
            return Promise.reject(reason);
        });
}

exports = module.exports = Trafikverket;