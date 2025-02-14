'use strict';
const HomeyEventEmitter = require('./homeyEventEmitter.js');
const apiErrorEventName = 'api_error';

const apiDomain = 'api.trafikinfo.trafikverket.se';
const apiEndpoint = '/v2/data.json';
const apiTimeout = 5000;

class Trafikverket extends HomeyEventEmitter {
    constructor(options) {
        super();
        if (options == null) { options = {} };
        this.options = options;
    }

    async postCommand(data) {
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml',
                'Accept': '*/*'
            },
            body: data,
            signal: AbortSignal.timeout(apiTimeout)
        };

        try {
            const response = await fetch(`https://${apiDomain}${apiEndpoint}`, options);

            if (response.ok) {
                return await response.json();
            }

            const message = await response.text();
            throw new Error(`Command '${data}' failed, HTTP status code '${response.status}', and message '${message}'`);
        } catch (error) {
            throw error;
        }
    }

    async getRoadConditionsByName(roadNumber) {
        const xmlReq = `<REQUEST><LOGIN authenticationkey='${this.options.token}'/>` +
            `<QUERY objecttype='RoadCondition' schemaversion='1.2'>` +
            '<FILTER>' +
            `<EQ name='RoadNumberNumeric' value='${roadNumber}' />` +
            '</FILTER>' +
            '<INCLUDE>Id</INCLUDE>' +
            '<INCLUDE>LocationText</INCLUDE>' +
            `</QUERY></REQUEST>`;

        try {
            return await this.postCommand(xmlReq);
        } catch (reason) {
            this.emit(apiErrorEventName, reason);
            throw reason;
        }
    }

    async getRoadConditionsByLocation(lat, long, radius) {
        const xmlReq = `<REQUEST><LOGIN authenticationkey='${this.options.token}'/>` +
            `<QUERY objecttype='RoadCondition' schemaversion='1.2'>` +
            '<FILTER>' +
            `<WITHIN name='Geometry.WGS84' shape='center' value='${long} ${lat}' radius='${radius}' />` +
            '</FILTER>' +
            '<INCLUDE>Id</INCLUDE>' +
            '<INCLUDE>LocationText</INCLUDE>' +
            `</QUERY></REQUEST>`;

        try {
            return await this.postCommand(xmlReq);
        } catch (reason) {
            this.emit(apiErrorEventName, reason);
            throw reason;
        }
    }

    async getRoadConditionDetails(conditionId) {
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

        try {
            return await this.postCommand(xmlReq);
        } catch (reason) {
            this.emit(apiErrorEventName, reason);
            throw reason;
        }
    }

    async getWeatherStationsByName(name) {
        const xmlReq = `<REQUEST><LOGIN authenticationkey='${this.options.token}'/>` +
            `<QUERY objecttype='WeatherMeasurepoint' schemaversion='2.1'>` +
            '<FILTER>' +
            `<LIKE name='Name' value='^${name}' />` +
            '</FILTER>' +
            '<INCLUDE>Id</INCLUDE>' +
            '<INCLUDE>Name</INCLUDE>' +
            '<INCLUDE>Geometry.WGS84</INCLUDE>' +
            `</QUERY></REQUEST>`;

        try {
            return await this.postCommand(xmlReq);
        } catch (reason) {
            this.emit(apiErrorEventName, reason);
            throw reason;
        }
    }

    async getWeatherStationsByLocation(lat, long, radius) {
        const xmlReq = `<REQUEST><LOGIN authenticationkey='${this.options.token}'/>` +
            `<QUERY objecttype='WeatherMeasurepoint' schemaversion='2.1'>` +
            '<FILTER>' +
            `<WITHIN name='Geometry.WGS84' shape='center' value='${long} ${lat}' radius='${radius}' />` +
            '</FILTER>' +
            '<INCLUDE>Id</INCLUDE>' +
            '<INCLUDE>Name</INCLUDE>' +
            '<INCLUDE>Geometry.WGS84</INCLUDE>' +
            `</QUERY></REQUEST>`;

        try {
            return await this.postCommand(xmlReq);
        } catch (reason) {
            this.emit(apiErrorEventName, reason);
            throw reason;
        }
    }

    async getWeatherStationDetails(stationId) {
        const xmlReq = `<REQUEST><LOGIN authenticationkey='${this.options.token}'/>` +
            `<QUERY objecttype='WeatherMeasurepoint' schemaversion='2.1'>` +
            '<FILTER>' +
            `<EQ name='Id' value='${stationId}' />` +
            '</FILTER>' +
            '<EXCLUDE>Observation.Aggregated10minutes</EXCLUDE>' +
            '<EXCLUDE>Observation.Aggregated5minutes</EXCLUDE>' +
            `</QUERY></REQUEST>`;

        try {
            return await this.postCommand(xmlReq);
        } catch (reason) {
            this.emit(apiErrorEventName, reason);
            throw reason;
        }
    }

    async getImageURLForWeatherStation(stationName) {
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

        try {
            return await this.postCommand(xmlReq);
        } catch (reason) {
            this.emit(apiErrorEventName, reason);
            throw reason;
        }
    }
}

module.exports = Trafikverket;
