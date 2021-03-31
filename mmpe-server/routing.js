/*
    Please use this file to register your endpoints.
 */

module.exports = function(app) {
    const spellRoute = require('./spellcheck/spellcheckRoute');
    app.use(spellRoute);
    const projectRoute = require('./project/projectRoute');
    app.use(projectRoute);
    const dictionaryRoute = require('./dictionary/dictionaryRoute');
    app.use(dictionaryRoute);
    const logRoute = require('./log/logRoute');
    app.use(logRoute);
    const middlewareRoute = require('./middlewares/middleware');
    app.use(middlewareRoute.requireLogin);
    app.use(middlewareRoute.router);
    const ibmSpeechRoute = require('./ibmSpeech/ibmSpeechRoute');
    app.use(ibmSpeechRoute);
    const eyeTrackingRoute = require('./eyeTracking/eyeTrackingRoute');
    app.use(eyeTrackingRoute);
    const midairGesturesRoute = require('./midairGestures/midairGesturesRoute');
    app.use(midairGesturesRoute);
    const capitalizationRoute = require('./capitalization/capitalizationRoute');
    app.use(capitalizationRoute);
};
