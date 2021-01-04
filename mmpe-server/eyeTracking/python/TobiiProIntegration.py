import tobii_research as tr
import time
import json
import math
import numpy as np

#########
# Config
#########
# appr. dist to monitor in cm
head_display_dist = 73
# appr. height of display in cm
display_height = 39.4
# appr. width of display in cm
display_width = 69.8
# spatial region in degrees that is considered one fixation
allowed_max_dispersion = 0.84
# duration that gaze coordinates need to be within the dispersion region for it to be considered a fixation
min_duration = 250  # in ms

# gaze data in current fixation
fixation_data = []
# currently in fixation?
in_fixation = False


def average_both_eyes(eye_data):
    """
    Generates one eye coordinate from the right and left eye
    """
    x = (float(eye_data['left']['gaze']['x']) + float(eye_data['right']['gaze']['x'])) / 2.0
    y = (float(eye_data['left']['gaze']['y']) + float(eye_data['right']['gaze']['y'])) / 2.0
    return {'pos': {'x': x, 'y': y}, 'ts': eye_data['ts']}


def compute_fixation_center():
    """
    Computes the center of all points in fixation_data
    """
    global fixation_data
    x_vals = [float(p['pos']['x']) for p in fixation_data]
    y_vals = [float(p['pos']['y']) for p in fixation_data]
    return {'x': sum(x_vals) / len(x_vals), 'y': sum(y_vals) / len(y_vals)}


def dist_in_degree(pos1, pos2):
    """
    Transforms coordinates from [0, 1] coordinate system to eye degress, then calculates difference in degress.
    """
    # eye opening angles of p1
    p1_x = math.degrees(math.atan((pos1['x'] * 2 - 1) * display_width / head_display_dist))
    p1_y = math.degrees(math.atan((pos1['y'] * 2 - 1) * display_height / head_display_dist))

    # eye opening angles of p2
    p2_x = math.degrees(math.atan((pos2['x'] * 2 - 1) * display_width / head_display_dist))
    p2_y = math.degrees(math.atan((pos2['y'] * 2 - 1) * display_height / head_display_dist))

    return np.sqrt((p1_x - p2_x) ** 2 + (p1_y - p2_y) ** 2)


def send_data(json_data):
    """
    Send to the caller
    Here: print so that node application can read it in
    This print is read from node.js as described in: https://medium.com/swlh/run-python-script-from-node-js-and-send-data-to-browser-15677fcf199f
    Then node.js sends it to the angular client via websockets
    """
    print(json.dumps(json_data) + '</eos>')  # add a symbol to mark the event


def calculate_and_send_fixation(coordinates_object):
    """
    Dispersion-based  algorithms  typically  identify  gaze  samples as belonging to a fixation if the samples are located within a spatially limited region (about 0.5º)
    for a minimum period of time: the minimum allowed fixation duration (usually, in the range 80–150 msec).
    Saccades are then detected implicitly as “everything else” (often excluding blinks and jitter).
    """
    global fixation_data, in_fixation
    # currently within fixation?
    if len(fixation_data) > 0:
        # compute center for distance estimation
        prev_fixation_center = compute_fixation_center()

        # compute current gaze center
        current_gaze_center = average_both_eyes(coordinates_object)

        # compute dispersion
        current_dispersion = dist_in_degree(current_gaze_center['pos'], prev_fixation_center)
        fixation_dispersion = max(current_dispersion, max([dist_in_degree(point['pos'], current_gaze_center['pos']) for point in fixation_data]))

        # if within distance threshold
        if fixation_dispersion < allowed_max_dispersion:

            # add to fixation
            fixation_data.append(current_gaze_center)

            # compute duration
            fixation_duration = int(fixation_data[-1]['ts'] * 1000) - int(fixation_data[0]['ts'] * 1000)  # in ms

            # if we just reached the duration threshold, send a fixation start event
            if not in_fixation and fixation_duration >= min_duration:
                in_fixation = True
                fixation_start = {'fixationStart': {'x': prev_fixation_center['x'], 'y': prev_fixation_center['y'],
                                                    'ts': coordinates_object['ts']}}
                send_data(fixation_start)

        else:  # a potential fixation is over
            in_fixation = False

            # compute duration
            fixation_duration = int(fixation_data[-1]['ts'] * 1000) - int(fixation_data[0]['ts'] * 1000)  # in ms

            # collected fixation data is valid (time threshold) -> report fixation
            if fixation_duration >= min_duration:
                fixation = {'fixationEnd': {'x': prev_fixation_center['x'], 'y': prev_fixation_center['y'],
                                        'duration': fixation_duration, 'dispersion': fixation_dispersion,
                                         'ts': coordinates_object['ts']}}
                send_data(fixation)

            # memorize gaze point as it might be the start of a new fixation
            fixation_data = [average_both_eyes(coordinates_object)]
    else:
        # should only happen on the very first data point
        fixation_data.append(average_both_eyes(coordinates_object))


def gaze_data_callback(gaze_data):
    """
    Callback for Tobii Pro SDK, doing all the work once data arrives
    """
    # Left eye
    gaze_left_eye = gaze_data['left_gaze_point_on_display_area']
    gaze_left = {'x': gaze_left_eye[0], 'y': gaze_left_eye[1], 'valid': gaze_data['left_gaze_point_validity']}
    pupil_left = {'diam': gaze_data['left_pupil_diameter'], 'valid': gaze_data['left_pupil_validity']}
    left = {'gaze': gaze_left, 'pupil': pupil_left}

    # Right eye
    gaze_right_eye = gaze_data['right_gaze_point_on_display_area']
    gaze_right = {'x': gaze_right_eye[0], 'y': gaze_right_eye[1], 'val': gaze_data['right_gaze_point_validity']}
    pupil_right = {'diam': gaze_data['right_pupil_diameter'], 'valid': gaze_data['right_pupil_validity']}
    right = {'gaze': gaze_right, 'pupil': pupil_right}

    # Both eyes
    gaze = {'gaze': {'ts': time.time(), 'left': left, 'right': right}}

    # Send
    send_data(gaze)

    # Calculate fixations and send if a fixation was detected
    calculate_and_send_fixation(gaze['gaze'])



found_eyetrackers = tr.find_all_eyetrackers()
my_eyetracker = found_eyetrackers[0]
# print("Address: " + my_eyetracker.address)
# print("Model: " + my_eyetracker.model)
# print("Name (It's OK if this is empty): " + my_eyetracker.device_name)
# print("Serial number: " + my_eyetracker.serial_number)


my_eyetracker.subscribe_to(tr.EYETRACKER_GAZE_DATA, gaze_data_callback, as_dictionary=True)
input()  # "Press Enter to exit..."
my_eyetracker.unsubscribe_from(tr.EYETRACKER_GAZE_DATA, gaze_data_callback)
