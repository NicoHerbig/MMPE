const lineReader = require('line-reader');
const Promise = require('bluebird');
const fs = require('fs');

// for study phase 3 projects, ensure the files are in the following order
const latinSquares = [
    ['REORDER_SINGLE', 'REORDER_GROUP', 'REPLACE_SINGLE', 'REPLACE_GROUP', 'INSERTION', 'DELETE_SINGLE', 'DELETE_GRUOP'],
    ['REPLACE_SINGLE', 'REPLACE_GROUP', 'DELETE_SINGLE', 'DELETE_GRUOP', 'REORDER_SINGLE', 'REORDER_GROUP', 'INSERTION'],
    ['DELETE_SINGLE', 'DELETE_GRUOP', 'INSERTION', 'REPLACE_SINGLE', 'REPLACE_GROUP', 'REORDER_SINGLE', 'REORDER_GROUP'],
    ['INSERTION', 'REORDER_SINGLE', 'REORDER_GROUP', 'DELETE_SINGLE', 'DELETE_GRUOP', 'REPLACE_SINGLE', 'REPLACE_GROUP'],
];

// for phases 1 and 2, just put the single order in a folder and set the latinsquare vairable below to ''
const projectId = 113 //213; // 101, 102, 
const latinSquare = 1;  // (Math.floor(projectId / 10) - 10) % 4; // 3 
const srcFilePath =         '../raw_data/midair_gestures/'+ latinSquare +'/src.txt'; //'../raw_data/got_data/src.txt'; // */  '../raw_data/wmt18_study_data/' + latinSquare + '/src.txt';
const mtFilePath =          '../raw_data/midair_gestures/'+ latinSquare +'/ref_with_manual_errors.txt';//'../raw_data/got_data/watson.txt'; // */ '../raw_data/wmt18_study_data/' + latinSquare + '/ref_with_manual_errors.txt';
const correctionsFilePath = '../raw_data/midair_gestures/'+ latinSquare +'/corrections.txt'; //'../raw_data/got_data/corrections.txt'; // */ '../raw_data/wmt18_study_data/' + latinSquare + '/corrections.txt';
const sourceLanguage = 'EN-US';
const targetLanguage = 'DE-DE';
const outputProjectFilePath = '../projects/project' + projectId + '.json';

const srcLines = [];
const mtLines = [];
const correctionsLines = [];
const modalities = ['Mouse & Keyboard', 'Mid-air Gestures & keyboard'];

const eachLine = Promise.promisify(lineReader.eachLine);
let prevOperation = '';
let segmentId = 1;

/**
 * Shuffles array in place. ES6 version
 * @param {Array} a items An array containing the items.
 */
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
eachLine(srcFilePath, 'utf8', function (line) {
    srcLines.push(line);
}).then(function () {
    eachLine(mtFilePath, 'utf8', function (line) {
        mtLines.push(line);
    }).then(function () {
        eachLine(correctionsFilePath, 'utf8', function (line) {
            correctionsLines.push(line);
        })
            .then(function () {
                let project = {};
                project.id = projectId;
                project.projectid = projectId;
                project.projectname = 'Project' + projectId;
                project.segments = [];

                const maxI = correctionsLines.length > 0 ? correctionsLines.length : srcLines.length;
                for (let i = 0; i < maxI; i++) {
                    let segment = {};
                    segment.source = srcLines[i];
                    segment.target = mtLines[i];
                    segment.mt = mtLines[i];
                    segment.sourceLanguage = sourceLanguage;
                    segment.targetLanguage = targetLanguage;
                    segment.segmentStatus = 1; // Unconfirmed

                    if (correctionsLines.length > 0) {
                        const splitLine = correctionsLines[i].split('#');
                        segment.studyOperation = splitLine[0];
                        if (segment.studyOperation !== prevOperation) {
                            segment.studyTrial = true;
                            prevOperation = segment.studyOperation;
                        } else {
                            segment.studyTrial = false;
                        }
                        segment.studyCorrection = splitLine[1];

                        // push segment once per modality, s.t. it can be editing with each
                        shuffle(modalities);
                        for (let j = 0; j < modalities.length; j++) {
                            let segmentCopy = JSON.parse(JSON.stringify(segment));
                            segmentCopy.studyModality = modalities[j];
                            segmentCopy.id = segmentId;
                            segmentId += 1;
                            project.segments.push(segmentCopy);
                        }
                    } else {
                        segment.id = segmentId;
                        segmentId += 1;
                        project.segments.push(segment); // push segment only once
                    }
                }

                fs.writeFileSync(outputProjectFilePath, JSON.stringify(project), 'utf8');
                console.log(outputProjectFilePath);
            })
            .catch(function (err) {
                console.error(err);
            });
    });
});
