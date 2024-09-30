'use strict';
const HomeyEventEmitter = require('./homeyEventEmitter.js');
const apiErrorEventName = 'api_error';

const apiEndpoint = 'https://api.trafikinfo.trafikverket.se/v2/data.json';
const apiTimeout = 10000;

class Trafikverket extends HomeyEventEmitter {
    constructor(options) {
        super();
        if (options == null) { options = {} };
        this.options = options;
    }

    getRoadConditionsByName = function (roadNumber) {

        const xmlReq = `<REQUEST><LOGIN authenticationkey='${this.options.token}'/>` +
            `<QUERY objecttype='RoadCondition' schemaversion='1.2'>` +
            '<FILTER>' +
            `<EQ name='RoadNumberNumeric' value='${roadNumber}' />` +
            '</FILTER>' +
            '<INCLUDE>Id</INCLUDE>' +
            '<INCLUDE>LocationText</INCLUDE>' +
            `</QUERY></REQUEST>`;

        return this.#invoke('POST', apiEndpoint, xmlReq)
            .then(result => {
                return Promise.resolve(result);
            })
            .catch(reason => {
                this.emit(apiErrorEventName, reason);
                return Promise.reject(reason);
            });
    }

    getRoadConditionsByLocation = function (lat, long, radius) {

        const xmlReq = `<REQUEST><LOGIN authenticationkey='${this.options.token}'/>` +
            `<QUERY objecttype='RoadCondition' schemaversion='1.2'>` +
            '<FILTER>' +
            `<WITHIN name='Geometry.WGS84' shape='center' value='${long} ${lat}' radius='${radius}' />` +
            '</FILTER>' +
            '<INCLUDE>Id</INCLUDE>' +
            '<INCLUDE>LocationText</INCLUDE>' +
            `</QUERY></REQUEST>`;

        return this.#invoke('POST', apiEndpoint, xmlReq)
            .then(result => {
                return Promise.resolve(result);
            })
            .catch(reason => {
                this.emit(apiErrorEventName, reason);
                return Promise.reject(reason);
            });
    }

    getRoadConditionDetails = function (conditionId) {

        const xmlReq = `<REQUEST><LOGIN authenticationkey='${this.options.token}'/>` +
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

        return this.#invoke('POST', apiEndpoint, xmlReq)
            .then(result => {
                return Promise.resolve(result);
            })
            .catch(reason => {
                this.emit(apiErrorEventName, reason);
                return Promise.reject(reason);
            });
    }

    getWeatherStationsByName = function (name) {

        const xmlReq = `<REQUEST><LOGIN authenticationkey='${this.options.token}'/>` +
            `<QUERY objecttype='WeatherMeasurepoint' schemaversion='2.1'>` +
            '<FILTER>' +
            `<LIKE name='Name' value='^${name}' />` +
            '</FILTER>' +
            '<INCLUDE>Id</INCLUDE>' +
            '<INCLUDE>Name</INCLUDE>' +
            '<INCLUDE>Geometry.WGS84</INCLUDE>' +
            `</QUERY></REQUEST>`;

        return this.#invoke('POST', apiEndpoint, xmlReq)
            .then(result => {
                return Promise.resolve(result);
            })
            .catch(reason => {
                this.emit(apiErrorEventName, reason);
                return Promise.reject(reason);
            });
    }

    getWeatherStationsByLocation = function (lat, long, radius) {

        const xmlReq = `<REQUEST><LOGIN authenticationkey='${this.options.token}'/>` +
            `<QUERY objecttype='WeatherMeasurepoint' schemaversion='2.1'>` +
            '<FILTER>' +
            `<WITHIN name='Geometry.WGS84' shape='center' value='${long} ${lat}' radius='${radius}' />` +
            '</FILTER>' +
            '<INCLUDE>Id</INCLUDE>' +
            '<INCLUDE>Name</INCLUDE>' +
            '<INCLUDE>Geometry.WGS84</INCLUDE>' +
            `</QUERY></REQUEST>`;

        return this.#invoke('POST', apiEndpoint, xmlReq)
            .then(result => {
                return Promise.resolve(result);
            })
            .catch(reason => {
                this.emit(apiErrorEventName, reason);
                return Promise.reject(reason);
            });
    }

    getWeatherStationDetails = function (stationId) {

        const xmlReq = `<REQUEST><LOGIN authenticationkey='${this.options.token}'/>` +
            `<QUERY objecttype='WeatherMeasurepoint' schemaversion='2.1'>` +
            '<FILTER>' +
            `<EQ name='Id' value='${stationId}' />` +
            '</FILTER>' +
            '<EXCLUDE>Observation.Aggregated10minutes</EXCLUDE>' +
            '<EXCLUDE>Observation.Aggregated5minutes</EXCLUDE>' +
            `</QUERY></REQUEST>`;

        return this.#invoke('POST', apiEndpoint, xmlReq)
            .then(result => {
                return Promise.resolve(result);
            })
            .catch(reason => {
                this.emit(apiErrorEventName, reason);
                return Promise.reject(reason);
            });
    }

    getImageURLForWeatherStation = function (stationName) {

        const xmlReq = `<REQUEST><LOGIN authenticationkey='${this.options.token}'/>` +
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

        return this.#invoke('POST', apiEndpoint, xmlReq)
            .then(result => {
                return Promise.resolve(result);
            })
            .catch(reason => {
                this.emit(apiErrorEventName, reason);
                return Promise.reject(reason);
            });
    }

    async #invoke(method, url, data) {
        let options = {
            method: method,
            timeout: apiTimeout,
            headers: {
                'Content-Type': 'text/xml',
                'Accept': '*/*'
            }
        };

        if (method == 'POST' && data) {
            options.body = data;
        }

        try {
            const request = new Request(url, options);
            const response = await fetch(request);

            if (!response.ok) {
                let json = {};
                try {
                    json = await response.json();
                    json.api = {
                        method: method,
                        url: url,
                        httpStatusCode: response.status
                    };
                    this.emit('error', json);
                } catch (ignore) { }

                let errorMessage = `${method} '${url}': HTTP status code '${response.status}' and message: '${JSON.stringify(json)}'`;
                if (json.error?.message) {
                    errorMessage = `${errorMessage}. TV API error message: ${json.error.message}`;
                }

                return Promise.reject(new Error(errorMessage));
            }

            let json = await response.json();
            //Append http response code
            json.statusCode = response.status;
            return Promise.resolve(json);

        } catch (error) {
            return Promise.reject(error);
        }
    }
}
module.exports = Trafikverket;
