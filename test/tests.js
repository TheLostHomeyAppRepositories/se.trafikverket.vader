'use strict';

const assert = require('assert');
const Trafikverket = require('../lib/tv_api.js');
var config = require('./config');

var TV = new Trafikverket({ token: config.token });

describe('VVIS', function () {

    describe('#getWeatherStationsByName()', function () {
        it('should return 10 locations', function (done) {
            TV.getWeatherStationsByName('Sto')
                .then(function (result) {
                    assert.strictEqual(result.RESPONSE.RESULT[0].WeatherMeasurepoint.length, 10);
                    done();
                });
        });
    });

    describe('#getWeatherStationsByLocation()', function () {
        it('should return 11 locations', function (done) {
            let lat = 55.695530700000006;
            let long = 13.0590207;
            TV.getWeatherStationsByLocation(lat, long, '20000m')
                .then(function (result) {
                    assert.strictEqual(result.RESPONSE.RESULT[0].WeatherMeasurepoint.length, 11);
                    done();
                });
        });
    });

    describe('#getWeatherStationDetails()', function () {
        it('should return Löddeköpinge', function (done) {
            //TV.getWeatherStationDetails('SE_STA_VVIS1211')
            TV.getWeatherStationDetails('1211')
                .then(function (result) {
                    assert.strictEqual(result.RESPONSE.RESULT[0].WeatherMeasurepoint[0].Name, 'Löddeköpinge');
                    done();
                });
        });
    });

});