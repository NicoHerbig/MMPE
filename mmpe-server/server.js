const app = require('express')();
const expressWs = require('express-ws')(app);
const cors = require('cors');
const config = require("./config.json");

app.use(cors());

// body-parser
const bodyParser = require('body-parser');
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

// REST api: assign routes
require('./routing')(app);

// run server
let mmpePort = process.env.MMPE_PORT || config.mmpePort || 3000;
app.listen(mmpePort, function () {
    console.log('MMPE-Server listening on port %i', mmpePort);
});
