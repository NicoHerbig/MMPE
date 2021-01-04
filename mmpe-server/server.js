const app = require('express')();
const expressWs = require('express-ws')(app);
const cors = require('cors');
const serverPort = 3000;

app.use(cors());

// body-parser
const bodyParser = require('body-parser');
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

// REST api: assign routes
require('./routing')(app);

// run server
app.listen(serverPort, function () {
    console.log('MMPE-Server listening on port 3000!');
});
