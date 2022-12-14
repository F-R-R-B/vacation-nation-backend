'use strict';
// imports
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const verifyUser = require('./auth/authorize');

const app = express();
app.use(cors());

app.use(express.json());

mongoose.connect(process.env.DB_URL);
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'mongo connection error'));
db.once('open', function () {
    console.log('Mongoose is connected to mongoose');
});

app.use(verifyUser);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`listening on ${PORT}`));

app.get('/', (req, res) => {
    res.status(200).send('Welcome!');
});


// modules
const getWeather = require('./modules/weather.js');
const flight = require('./modules/flight.js');
const axios = require('axios');

async function getFlights(req, res) {
    const axios = require('axios');
    try {
        const departureDate = req.query.departureDate;
        const returnDate = req.query.returnDate;
        //  const originCoords = (req.query.lat, req.query.lon);
        //  const destinationCoords = (req.query.lat, req.query.lon);
        const origin = await getIATA(req.query.originlat, req.query.originlon);
        const destination = await getIATA(req.query.destinationlat, req.query.destinationlon);
        const flightResponse = await axios.get(`https://api.flightapi.io/roundtrip/${process.env.FLIGHT_API_KEY}/${origin}/${destination}/${departureDate}/${returnDate}/1/0/1/Economy/USD`);
        // console.log("🚀 ~ file: server.js ~ line 44 ~ getFlights ~ flightResponse", flightResponse);
        // console.log("🚀 ~ file: server.js ~ line 45 ~ getFlights ~ t", t);
        
        const data = flightResponse.data;
        const flights = data.trips;
        // console.log("🚀 ~ file: server.js ~ line 49 ~ getFlights ~ flights", flights);
        
        const legs = data.legs;
        const fares = data.fares;
        const airlines = data.airlines;
        const results = flights.map(el => {
            const dLeg = legs.find(leg => leg.id === el.legIds[0]);
            const rLeg = legs.find(leg => leg.id === el.legIds[1]);
            const dateFormat = (dateString) => new Intl.DateTimeFormat('en-US', {year: 'numeric', month: 'short', weekday: 'short', day: 'numeric'}).format(new Date(dateString));
            const newTrip = ({
                id: el.id, 
                departure: {
                    // date: dLeg.departureDateTime.match(/^\d{4}\-\d{2}\-\d{2}/),
                    date: dateFormat(dLeg.departureDateTime),
                    stops: dLeg.stopoversCount,
                    overnight: dLeg.overnight,
                    airline: airlines.find(airline => airline.code === dLeg.airlineCodes[0]).name,
                    departureTime: dLeg.departureTime,
                    arrivalTime: dLeg.arrivalTime,
                }, 
                return: {
                    // date: aLeg.departureDateTime.match(/^\d{4}\-\d{2}\-\d{2}/),
                    date: dateFormat(rLeg.departureDateTime),
                    stops: rLeg.stopoversCount,
                    overnight: rLeg.overnight,
                    airline: airlines.find(airline => airline.code === rLeg.airlineCodes[0]).name,
                    departureTime: rLeg.departureTime,
                    arrivalTime: rLeg.arrivalTime,
                },
                price: fares.find(fare => fare.tripId === el.id).price.totalAmount
            });
            // console.log("🚀 ~ file: test.js ~ line 15 ~ nonstop ~ newTrip", newTrip);
            return newTrip;
        } );
        // console.log("🚀 ~ file: server.js ~ line 76 ~ results ~ results", results);
        const sortedResults = results.sort((a,b) => a.price - b.price);
        // console.log("🚀 ~ file: server.js ~ line 78 ~ getFlights ~ sortedResults", sortedResults);
        const sliced = sortedResults.slice(0,5);
        console.log("🚀 ~ file: server.js ~ line 80 ~ getFlights ~ sliced", sliced);

        // console.log('SUCCESS??');
        res.status(200).send(sliced);

    } catch (error) {
        console.log(error.message, 'from getFlights');
    }
}

async function getIATA(lat, lon) {
    try {
        const response = await axios.get(`https://airlabs.co/api/v9/nearby?lat=${lat}&lng=${lon}&distance=20&api_key=${process.env.AIRLABS_API_KEY}`);
        // console.log(response);
        const items = response.data.response.airports;
        // console.log("🚀 ~ file: server.js ~ line 94 ~ getIATA ~ items", items);
        const iata = items.sort((a,b) => b.popularity - a.popularity)[0].iata_code;
        return iata;
    } catch (error) {
        console.log(error.message, 'from getIATA');
    }
}


// 103-115 DataBase

async function postSaved(req, res, next) {
    // console.log(req.body);
    try {
      const newflight = await flight.create(req.body);
      res.status(200).send(newflight);
    } catch (error) {
      next(error);
    }
}

async function getSaved(req, res, next) {
    try {
        const flights = await flight.find( {user: req.user.email} );
        res.status(200).send(flights);
    } catch (error) {
    next(error);
  }
}

async function deleteSaved(req, res, next) {
    try {
        const id = req.params.id;
        await flight.findByIdAndDelete(id);
        res.status(204).send('flight deleted');
    } catch (error) {
        next(error);
    }
}


// Endpoints
app.get('/weather', getWeather);
app.get('/flights', getFlights);
app.post('/saved', postSaved);
app.get('/saved', getSaved);
app.delete('/saved/:id', deleteSaved);


app.get('*', (req, res) => {
    res.status(404).send('Not Found');
});


app.use((error, req, res) => {
    res.status(500).send(error.message);
});

