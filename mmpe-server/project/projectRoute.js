const router = require('express').Router();
const fs = require("fs");

const basePath = './data/projects/';

function getFileNameForProjectId(projectId) {
    return basePath + 'project' + projectId + '.json'
}

function getProjectIdFromFileName(filename) {
    var numberPattern = /\d+/g;
    var numbersInString = filename.match(numberPattern);
    if (numbersInString.length === 1) {
        return parseInt(numbersInString[0]);
    } else {
        return null;
    }
}

router.route('/projects').get(
    function(req, res) {
        fs.readdir(basePath, (err, files) => {
            var projects = [];
            files.forEach(file => {
                if(file.endsWith('.json')) {
                    var projectId = getProjectIdFromFileName(file);
                    if (projectId !== null) {
                        projects.push(projectId);
                    }
                }
            });
            res.json(projects);
        });
    });

router.route('/projects/:projectid').get(
    function(req, res) {
        const filePath = getFileNameForProjectId(req.params.projectid);
        fs.readFile(filePath, function(err, data) {
            if (err) { console.log(err) }
            const project = JSON.parse(data);
            res.json(project);
        });
    });

router.route('/projects/:projectid').put(
    function(req, res) {
        console.log('>> RECEIVED PUT at /projects/' + req.params.projectid);

        const filePath = getFileNameForProjectId(req.params.projectid);
        // console.log(req.body);
        // console.log(JSON.stringify(req.body));
        fs.writeFile(filePath, JSON.stringify(req.body), (err) => {
            if (err) {
                console.log(err);
                res.status(400).send('Could not write project to file.');
            } else {
                console.log("Successfully written project" + req.params.projectid + " to file.");
                res.status(200).end();
            }
        });
    });


module.exports = router;
