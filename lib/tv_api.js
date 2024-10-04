'use strict';
const http = require('http.min');
const HomeyEventEmitter = require('./homeyEventEmitter.js');
const apiErrorEventName = 'api_error';

const apiProtocol = 'https:';
const apiDomain = 'api.trafikinfo.trafikverket.se';
const apiEndpoint = '/v2/data.json';
const apiTimeout = 5000;

class Trafikverket extends HomeyEventEmitter {
    constructor(options) {
        super();
        if (options == null) { options = {} };
        this.options = options;
    }

    getRoadConditionsByName = function (roadNumber) {
        var self = this;

        const xmlReq = `<REQUEST><LOGIN authenticationkey='${self.options.token}'/>` +
            `<QUERY objecttype='RoadCondition' schemaversion='1.2'>` +
            '<FILTER>' +
            `<EQ name='RoadNumberNumeric' value='${roadNumber}' />` +
            '</FILTER>' +
            '<INCLUDE>Id</INCLUDE>' +
            '<INCLUDE>LocationText</INCLUDE>' +
            `</QUERY></REQUEST>`;

        return postCommand(xmlReq)
            .then(function (result) {
                return Promise.resolve(result);
            })
            .catch(reason => {
                self.emit(apiErrorEventName, reason);
                return Promise.reject(reason);
            });
    }

    getRoadConditionsByLocation = function (lat, long, radius) {
        var self = this;

        const xmlReq = `<REQUEST><LOGIN authenticationkey='${self.options.token}'/>` +
            `<QUERY objecttype='RoadCondition' schemaversion='1.2'>` +
            '<FILTER>' +
            `<WITHIN name='Geometry.WGS84' shape='center' value='${long} ${lat}' radius='${radius}' />` +
            '</FILTER>' +
            '<INCLUDE>Id</INCLUDE>' +
            '<INCLUDE>LocationText</INCLUDE>' +
            `</QUERY></REQUEST>`;

        return postCommand(xmlReq)
            .then(function (result) {
                return Promise.resolve(result);
            })
            .catch(reason => {
                self.emit(apiErrorEventName, reason);
                return Promise.reject(reason);
            });
    }

    getRoadConditionDetails = function (conditionId) {
        var self = this;

        const xmlReq = `<REQUEST><LOGIN authenticationkey='${self.options.token}'/>` +
            `<QUERY objecttype='RoadCondition' schemaversion='1.2'>` +
            '<FILTER>' +
            `<EQ name='Id' value='${conditionId}' />` +
            '</FILTER>' +
            '<INCLUDE>Id</INCLUDE>' +
            '<INCLUDE>CountyNo</INCLUDE>' +
            '<INCLUDE>ConditionCode</INCLUDE>' +
            '<INCLUDE>ConditionInfo</INCLUDE>' +
            '<INCLUDE>ConditionText</INCLUDE>' +
            '<INCLUDE>LocationText</INCLUDE>' +
            '<INCLUDE>RoadNumber</INCLUDE>' +
            '<INCLUDE>StartTime</INCLUDE>' +
            '<INCLUDE>ModifiedTime</INCLUDE>' +
            `</QUERY></REQUEST>`;

        return postCommand(xmlReq)
            .then(function (result) {
                return Promise.resolve(result);
            })
            .catch(reason => {
                self.emit(apiErrorEventName, reason);
                return Promise.reject(reason);
            });
    }

    getWeatherStationsByName = function (name) {
        var self = this;

        const xmlReq = `<REQUEST><LOGIN authenticationkey='${self.options.token}'/>` +
            `<QUERY objecttype='WeatherMeasurepoint' schemaversion='2.1'>` +
            '<FILTER>' +
            `<LIKE name='Name' value='^${name}' />` +
            '</FILTER>' +
            '<INCLUDE>Id</INCLUDE>' +
            '<INCLUDE>Name</INCLUDE>' +
            '<INCLUDE>Geometry.WGS84</INCLUDE>' +
            `</QUERY></REQUEST>`;

        return postCommand(xmlReq)
            .then(function (result) {
                return Promise.resolve(result);
            })
            .catch(reason => {
                self.emit(apiErrorEventName, reason);
                return Promise.reject(reason);
            });
    }

    getWeatherStationsByLocation = function (lat, long, radius) {
        var self = this;

        const xmlReq = `<REQUEST><LOGIN authenticationkey='${self.options.token}'/>` +
            `<QUERY objecttype='WeatherMeasurepoint' schemaversion='2.1'>` +
            '<FILTER>' +
            `<WITHIN name='Geometry.WGS84' shape='center' value='${long} ${lat}' radius='${radius}' />` +
            '</FILTER>' +
            '<INCLUDE>Id</INCLUDE>' +
            '<INCLUDE>Name</INCLUDE>' +
            '<INCLUDE>Geometry.WGS84</INCLUDE>' +
            `</QUERY></REQUEST>`;

        return postCommand(xmlReq)
            .then(function (result) {
                return Promise.resolve(result);
            })
            .catch(reason => {
                self.emit(apiErrorEventName, reason);
                return Promise.reject(reason);
            });
    }

    getWeatherStationDetails = function (stationId) {
        var self = this;

        const xmlReq = `<REQUEST><LOGIN authenticationkey='${self.options.token}'/>` +
            `<QUERY objecttype='WeatherMeasurepoint' schemaversion='2.1'>` +
            '<FILTER>' +
            `<EQ name='Id' value='${stationId}' />` +
            '</FILTER>' +
            '<EXCLUDE>Observation.Aggregated10minutes</EXCLUDE>' +
            '<EXCLUDE>Observation.Aggregated5minutes</EXCLUDE>' +
            `</QUERY></REQUEST>`;

        return postCommand(xmlReq)
            .then(function (result) {
                return Promise.resolve(result);
            })
            .catch(reason => {
                self.emit(apiErrorEventName, reason);
                return Promise.reject(reason);
            });
    }

    getImageURLForWeatherStation = function (stationName) {
        var self = this;

        const xmlReq = `<REQUEST><LOGIN authenticationkey='${self.options.token}'/>` +
            `<QUERY objecttype='Camera' schemaversion='1'>` +
            '<FILTER>' +
            `<LIKE name='Name' value='^${stationName}' />` +
            '</FILTER>' +
            '<INCLUDE>PhotoUrl</INCLUDE>' +
            '<INCLUDE>HasFullSizePhoto</INCLUDE>' +
            '<INCLUDE>Type</INCLUDE>' +
            '<INCLUDE>Name</INCLUDE>' +
            '<INCLUDE>Id</INCLUDE>' +
            `</QUERY></REQUEST>`;

        return postCommand(xmlReq)
            .then(function (result) {
                return Promise.resolve(result);
            })
            .catch(reason => {
                self.emit(apiErrorEventName, reason);
                return Promise.reject(reason);
            });
    }
}
module.exports = Trafikverket;

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
