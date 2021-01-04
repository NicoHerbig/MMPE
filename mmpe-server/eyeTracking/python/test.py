from time import sleep
import json

dummy_data = [
    {"gaze": {"ts": 1602163076.5961928, "left": {"gaze": {"x": 0.33473914861679077, "y": 0.1226513609290123, "valid": 1}, "pupil": {"diam": 3.48779296875, "valid": 1}}, "right": {"gaze": {"x": 0.3278074562549591, "y": 0.08095194399356842, "val": 1}, "pupil": {"diam": 3.4463653564453125, "valid": 1}}}},
    {"gaze": {"ts": 1602163076.6211925, "left": {"gaze": {"x": 0.3355634808540344, "y": 0.1216871365904808, "valid": 1}, "pupil": {"diam": 3.4872283935546875, "valid": 1}}, "right": {"gaze": {"x": 0.32826539874076843, "y": 0.08179660141468048, "val": 1}, "pupil": {"diam": 3.4434661865234375, "valid": 1}}}}
    ]

while True:
    for entry in dummy_data:
        print(json.dumps(entry) + '</eos>')
        sleep(0.01)
