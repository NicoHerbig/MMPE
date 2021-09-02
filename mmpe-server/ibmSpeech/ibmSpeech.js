'use strict';


/* eslint-env node, es6 */


function callIbmASR() {


// ibmSpeech to text token endpoint


}



const express = require('express');
const app = express();
const AuthorizationV1 = require('ibm-watson/authorization/v1');
const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1');
const cors = require('cors');
const config = require("../config.json");




const vcapServices = require('vcap_services');
//require('dotenv').config({ silent: true });

if (process.env.VCAP_SERVICES) {
    // enable rate-limiting
    const RateLimit = require('express-rate-limit');
    app.enable('trust proxy'); // required to work properly behind Bluemix's reverse proxy

    const limiter = new RateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    });

    //  apply to /api/*
    app.use('/api/', limiter);

    // force https - microphone access requires https in Chrome and possibly other browsers
    // (*.mybluemix.net domains all have built-in https support)
    const secure = require('express-secure-only');
    app.use(secure());
}

app.use(express.static(__dirname + '/static'));
app.use(cors());



const sttCredentials = Object.assign(
    {
        username: config.ibmSpeech.username, //process.env.SPEECH_TO_TEXT_USERNAME, // or hard-code credentials here
        password:  config.ibmSpeech.password, //process.env.SPEECH_TO_TEXT_PASSWORD,
        iam_apikey: config.ibmSpeech.iamApikey, // if using an RC service
        //url: process.env.AUTHORIZATION_API,
        //url: process.env.SPEECH_TO_TEXT_URL ? process.env.SPEECH_TO_TEXT_URL : SpeechToTextV1.URL,
        url: 'https://stream-fra.watsonplatform.net/speech-to-text/api',
        //version: 'v3.12.0'
    },
    vcapServices.getCredentials('speech_to_text') // pulls credentials from environment in bluemix, otherwise returns {}
);


app.use('/api/Speech-to-text/token', function(req, res) {

    const sttAuthService = new AuthorizationV1(sttCredentials);
    //alert(sttAuthService.setAccessToken());
    sttAuthService.getToken(function(err, response) {//IBM.WatsonDeveloperCloud.Util.TokenManager.GetToken
        if (err) {
            console.log('Error retrieving token: ', err);
            res.status(500).send('Error retrieving token');
            return;
        }
        const token = response.token || response;
        if (sttCredentials.iam_apikey) {
            res.json({ access_token: token, url: sttCredentials.url });
        } else {
            res.json({ token: token, url: sttCredentials.url });
        }
    });
});

const port = process.env.PORT || process.env.VCAP_APP_PORT || 3002;
app.listen(port, function() {
    console.log('Example IBM Watson Speech JS SDK client app & token server live at http://localhost:%s/', port);
});

module.exports = app;
