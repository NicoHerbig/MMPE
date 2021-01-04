const fs = require("fs");

module.exports.logLowlevelEvents = function(event) {
   writeToFile('./log/logFiles/lowlevelLog.txt', event);
};

module.exports.logHighlevelEvents = function(event) {
    writeToFile('./log/logFiles/highlevelLog.txt', event);
};

function writeToFile(file, data) {

    // create empty file if not already existing
    if (!fs.existsSync(file)) {
        fs.appendFileSync(file, '');
    }

    // append to file
    fs.open(file, 'a', (err, fd) => {
        if (err) throw err;

        fs.appendFile(fd, JSON.stringify(data) + '\n', 'utf8', (err) => {
            if (err) throw err;

            fs.close(fd, (err) => {
                if (err) throw err;
            });
        });
    });
}
