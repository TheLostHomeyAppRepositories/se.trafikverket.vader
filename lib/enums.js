'use strict';

exports.decodePrecipitationName = function (name) {
    switch (name) {
        case 'Givare saknas/Fel på givare': return 'precipitation.error'; break;
        case 'Lätt regn': return 'precipitation.light_rain'; break;
        case 'Måttligt regn': return 'precipitation.moderate_rain'; break;
        case 'Kraftigt regn': return 'precipitation.heavy_rain'; break;
        case 'Lätt snöblandat regn': return 'precipitation.light_snow_rain'; break;
        case 'Måttligt snöblandat regn': return 'precipitation.moderate_snow_rain'; break;
        case 'Kraftigt snöblandat regn': return 'precipitation.heavy_snow_rain'; break;
        case 'Lätt snöfall': return 'precipitation.light_snow'; break;
        case 'Måttligt snöfall': return 'precipitation.moderate_snow'; break;
        case 'Kraftigt snöfall': return 'precipitation.heavy_snow'; break;
        case 'Annan nederbördstyp': return 'precipitation.other'; break;
        case 'Ingen nederbörd': return 'precipitation.none'; break;
        case 'Okänd nederbördstyp': return 'precipitation.unknown'; break;
        default: return `UNKNOWN (${name})`; break;
    }
}

exports.decodeWindDirection = function (name) {
    switch (name) {
        case 'Öst': return 'wind.east'; break;
        case 'Nordöst': return 'wind.nort_east'; break;
        case 'Östsydöst': return 'wind.east_south_east'; break;
        case 'Norr': return 'wind.north'; break;
        case 'Nordnordöst': return 'wind.nort_north_east'; break;
        case 'Nordnordväst': return 'wind.nort_north_west'; break;
        case 'Nordväst': return 'wind.nort_west'; break;
        case 'Söder': return 'wind.south'; break;
        case 'Sydöst': return 'wind.south_east'; break;
        case 'Sydsydväst': return 'wind.south_south_west'; break;
        case 'Sydväst': return 'wind.south_west'; break;
        case 'Väst': return 'wind.west'; break;
        default: return `UNKNOWN (${name})`; break;
    }
}