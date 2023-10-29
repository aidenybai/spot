import io
import logging
import math
import os
import signal
import sys
import threading
import time
from collections import OrderedDict

import bosdyn.api.basic_command_pb2 as basic_command_pb2
import bosdyn.api.power_pb2 as PowerServiceProto
# import bosdyn.api.robot_command_pb2 as robot_command_pb2
import bosdyn.api.robot_state_pb2 as robot_state_proto
import bosdyn.api.spot.robot_command_pb2 as spot_command_pb2
import bosdyn.client.util
from bosdyn.api import geometry_pb2
from bosdyn.client import ResponseError, RpcError, create_standard_sdk
from bosdyn.client.async_tasks import AsyncGRPCTask, AsyncPeriodicQuery, AsyncTasks
from bosdyn.client.estop import EstopClient, EstopEndpoint, EstopKeepAlive
from bosdyn.client.frame_helpers import ODOM_FRAME_NAME
from bosdyn.client.lease import Error as LeaseBaseError
from bosdyn.client.lease import LeaseClient, LeaseKeepAlive
from bosdyn.client.power import PowerClient
from bosdyn.client.robot_command import RobotCommandBuilder, RobotCommandClient
from bosdyn.client.robot_state import RobotStateClient
from bosdyn.client.time_sync import TimeSyncError
from bosdyn.util import duration_str, format_metric, secs_to_hms

LOGGER = logging.getLogger()

VELOCITY_BASE_SPEED = 1 # 0.5  # m/s
VELOCITY_BASE_ANGULAR = 0.8  # rad/sec
VELOCITY_CMD_DURATION = 0.5  # seconds
# COMMAND_INPUT_RATE = 0.05


def _grpc_or_log(desc, thunk):
  try:
    return thunk()
  except (ResponseError, RpcError) as err:
    LOGGER.error('Failed %s: %s', desc, err)


class ExitCheck(object):
  """A class to help exiting a loop, also capturing SIGTERM to exit the loop."""

  def __init__(self):
    self._kill_now = False
    signal.signal(signal.SIGTERM, self._sigterm_handler)
    signal.signal(signal.SIGINT, self._sigterm_handler)

  def __enter__(self):
    return self

  def __exit__(self, _type, _value, _traceback):
    return False

  def _sigterm_handler(self, _signum, _frame):
    self._kill_now = True

  def request_exit(self):
    """Manually trigger an exit (rather than sigterm/sigint)."""
    self._kill_now = True

  @property
  def kill_now(self):
    """Return the status of the exit checker indicating if it should exit."""
    return self._kill_now


class AsyncRobotState(AsyncPeriodicQuery):
  """Grab robot state."""

  def __init__(self, robot_state_client):
    super(AsyncRobotState, self).__init__('robot_state',
                                          robot_state_client,
                                          LOGGER,
                                          period_sec=0.2)

  def _start_query(self):
    return self._client.get_robot_state_async()


class WasdInterface(object):
  """A curses interface for driving the robot."""

  def __init__(self, robot):
    self._robot = robot
    # Create clients -- do not use the for communication yet.
    self._lease_client = robot.ensure_client(LeaseClient.default_service_name)
    try:
      self._estop_client = self._robot.ensure_client(
          EstopClient.default_service_name)
      self._estop_endpoint = EstopEndpoint(self._estop_client, 'GNClient', 9.0)
    except:
      # Not the estop.
      self._estop_client = None
      self._estop_endpoint = None
    self._power_client = robot.ensure_client(PowerClient.default_service_name)
    self._robot_state_client = robot.ensure_client(
        RobotStateClient.default_service_name)
    self._robot_command_client = robot.ensure_client(
        RobotCommandClient.default_service_name)
    self._robot_state_task = AsyncRobotState(self._robot_state_client)
    self._async_tasks = AsyncTasks([self._robot_state_task])
    self._lock = threading.Lock()
    self._command_dictionary = {
        27: self._stop,  # ESC key
        ord('\t'): self._quit_program,
        ord('T'): self._toggle_time_sync,
        ord(' '): self._toggle_estop,
        ord('c'): self._circle_move
        ord('r'): self._self_right,
        ord('P'): self._toggle_power,
        ord('p'): self._toggle_power,
        ord('v'): self._sit,
        ord('b'): self._battery_change_pose,
        ord('f'): self._stand,
        ord('w'): self._move_forward,
        ord('s'): self._move_backward,
        ord('a'): self._strafe_left,
        ord('d'): self._strafe_right,
        ord('q'): self._turn_left,
        ord('e'): self._turn_right,
        ord('u'): self._unstow,
        ord('j'): self._stow,
        ord('l'): self._toggle_lease,
        ord('g'): self._desmos,
    }
    self._locked_messages = ['', '', '']  # string: displayed message for user
    self._estop_keepalive = None
    self._exit_check = None

    # Stuff that is set in start()
    self._robot_id = None
    self._lease_keepalive = None

  def start(self):
    """Begin communication with the robot."""
    # Construct our lease keep-alive object, which begins RetainLease calls in a thread.
    self._lease_keepalive = LeaseKeepAlive(self._lease_client,
                                           must_acquire=True,
                                           return_at_exit=True)

    self._robot_id = self._robot.get_id()
    if self._estop_endpoint is not None:
      self._estop_endpoint.force_simple_setup(
      )  # Set this endpoint as the robot's sole estop.

  def shutdown(self):
    """Release control of robot as gracefully as possible."""
    LOGGER.info('Shutting down WasdInterface.')
    if self._estop_keepalive:
      # This stops the check-in thread but does not stop the robot.
      self._estop_keepalive.shutdown()
    if self._lease_keepalive:
      self._lease_keepalive.shutdown()

  def flush_and_estop_buffer(self, stdscr):
    """Manually flush the curses input buffer but trigger any estop requests (space)"""
    key = ''
    while key != -1:
      key = stdscr.getch()
      if key == ord(' '):
        self._toggle_estop()

  def add_message(self, msg_text):
    print(msg_text)
    # with self._lock:
    #     self._locked_messages = [msg_text] + self._locked_messages[:-1]

  def message(self, idx):
    """Grab one of the 3 last messages added."""
    with self._lock:
      return self._locked_messages[idx]

  @property
  def robot_state(self):
    """Get latest robot state proto."""
    return self._robot_state_task.proto

  def drive(self):
    with ExitCheck() as self._exit_check:
      try:
        while not self._exit_check.kill_now:
          self._async_tasks.update()
          # self._lease_str()
          # self._drive_draw(stdscr, self._lease_keepalive)

          try:
            cmds = input("enter input> ")
            print(self._estop_str(), self._power_state_str())
            for c in cmds:
              print(c)
              self._drive_cmd(c)

            print(self._estop_str(), self._power_state_str())
          except Exception:
            # On robot command fault, sit down safely before killing the program.
            self._safe_power_off()
            time.sleep(2.0)
            raise
      finally:
        pass

  def _drive_cmd(self, key):
    """Run user commands at each update."""
    try:
      cmd_function = self._command_dictionary[key]
      cmd_function()

    except KeyError:
      if key and key != -1 and key < 256:
        self.add_message(f'Unrecognized keyboard command: \'{chr(key)}\'')

  def _try_grpc(self, desc, thunk):
    try:
      return thunk()
    except (ResponseError, RpcError, LeaseBaseError) as err:
      self.add_message(f'Failed {desc}: {err}')
      return None

  def _try_grpc_async(self, desc, thunk):

    def on_future_done(fut):
      try:
        fut.result()
      except (ResponseError, RpcError, LeaseBaseError) as err:
        self.add_message(f'Failed {desc}: {err}')
        return None

    future = thunk()
    future.add_done_callback(on_future_done)

  def _quit_program(self):
    self._sit()
    if self._exit_check is not None:
      self._exit_check.request_exit()

  def _toggle_time_sync(self):
    if self._robot.time_sync.stopped:
      self._robot.start_time_sync()
    else:
      self._robot.time_sync.stop()

  def _toggle_estop(self):
    """toggle estop on/off. Initial state is ON"""
    if self._estop_client is not None and self._estop_endpoint is not None:
      if not self._estop_keepalive:
        self._estop_keepalive = EstopKeepAlive(self._estop_endpoint)
      else:
        self._try_grpc('stopping estop', self._estop_keepalive.stop)
        self._estop_keepalive.shutdown()
        self._estop_keepalive = None

  def _toggle_lease(self):
    """toggle lease acquisition. Initial state is acquired"""
    if self._lease_client is not None:
      if self._lease_keepalive is None:
        self._lease_keepalive = LeaseKeepAlive(self._lease_client,
                                               must_acquire=True,
                                               return_at_exit=True)
      else:
        self._lease_keepalive.shutdown()
        self._lease_keepalive = None

  def _start_robot_command(self, desc, command_proto, end_time_secs=None):

    def _start_command():
      self._robot_command_client.robot_command(command=command_proto,
                                               end_time_secs=end_time_secs)

    self._try_grpc(desc, _start_command)

  def _self_right(self):
    self._start_robot_command('self_right',
                              RobotCommandBuilder.selfright_command())

  def _battery_change_pose(self):
    # Default HINT_RIGHT, maybe add option to choose direction?
    self._start_robot_command(
        'battery_change_pose',
        RobotCommandBuilder.battery_change_pose_command(
            dir_hint=basic_command_pb2.BatteryChangePoseCommand.Request.
            HINT_RIGHT))

  def _sit1(self):
    for i in range(10):
      pitch_angles = [math.radians(3 * i), 0, math.radians(-(3 * i)), 0]

      time_per_pose = 1 / len(pitch_angles)

      for pitch in pitch_angles:
        footprint_R_body = bosdyn.geometry.EulerZXY(yaw=pitch,
                                                    roll=0,
                                                    pitch=abs(pitch))
        self._start_robot_command(
            'aidentwerk',
            RobotCommandBuilder.synchro_stand_command(wq
                footprint_R_body=footprint_R_body))
        time.sleep(time_per_pose)
      print("hi")
    # self._start_robot_command('sit', RobotCommandBuilder.synchro_sit_command())

  def f(self, x):
      return math.sin(20*x)
      # if x == 0:
      #   return 900000
      # return math.sin(1.0/x)
    # return x**2
    # return math.sin(math.pi * x)

  def _sit2(self):
    for i in range(10):
      # pitch_angles = [math.radians(5 * i), math.radians(-(5*i))]

      time_per_pose = 2 / 10.0
      m = i * math.pi / 5.0
      # for pitch in pitch_angles:
      footprint_R_body = bosdyn.geometry.EulerZXY(yaw=math.cos(m) * 30,
                                                  roll=0,
                                                  pitch=math.sin(m) * 30)
      self._start_robot_command(
          'aidentwerk',
          RobotCommandBuilder.synchro_stand_command(
              footprint_R_body=footprint_R_body))
      time.sleep(time_per_pose)

  def _desmos(self):
    num_points = 40
    time_per_pose = 0.125/2
    time_step = [i for i in range(num_points)]
    time_step += [i for i in range(num_points, 0, -1)]
    for t in time_step:
      x = (2.0 * t / num_points - 1)
      print(x, self.f(x))
      footprint_R_body = bosdyn.geometry.EulerZXY(yaw=x * math.pi / 6,
                                                  roll=0,
                                                  pitch=-self.f(x) * math.pi /
                                                  6)
      self._start_robot_command(
          'desmos',
          RobotCommandBuilder.synchro_stand_command(
              footprint_R_body=footprint_R_body))
      time.sleep(time_per_pose)

  def _sit(self):
    num_points = 20  # actual points will be x2 per cycle
    time_per_pose = 0.25
    time_step = [i for i in range(num_points)]
    time_step += [i for i in range(num_points, 0, -1)]
    for t in time_step:
      x = (2.0 * t / num_points - 1)  # normalize -1 to 1
      # print(x, self.f(x))
      footprint_R_body = bosdyn.geometry.EulerZXY(
          yaw=x * 30.0, roll=0, pitch=-math.sin(math.pi * x) * 30.0)  # normalize degrees from -30 to 30
      self._start_robot_command(
          'desmos',
          RobotCommandBuilder.synchro_stand_command(
              footprint_R_body=footprint_R_body))
      time.sleep(time_per_pose)

  def _stand(self):
    self._start_robot_command('stand',
                              RobotCommandBuilder.synchro_stand_command())

  def _circle_move(self):
    self._velocity_cmd_helper('circle_move', v_x=VELOCITY_BASE_SPEED/, v_rot=VELOCITY_BASE_ANGULAR*3, dur=2)

  def _move_forward(self):
    self._velocity_cmd_helper('move_forward', v_x=VELOCITY_BASE_SPEED)

  def _move_backward(self):
    self._velocity_cmd_helper('move_backward', v_x=-VELOCITY_BASE_SPEED)

  def _strafe_left(self):
    self._velocity_cmd_helper('strafe_left', v_y=VELOCITY_BASE_SPEED)

  def _strafe_right(self):
    self._velocity_cmd_helper('strafe_right', v_y=-VELOCITY_BASE_SPEED)

  def _turn_left(self):
    self._velocity_cmd_helper('turn_left', v_rot=VELOCITY_BASE_ANGULAR)

  def _turn_right(self):
    self._velocity_cmd_helper('turn_right', v_rot=-VELOCITY_BASE_ANGULAR)

  def _stop(self):
    self._start_robot_command('stop', RobotCommandBuilder.stop_command())

  def _velocity_cmd_helper(self, desc='', v_x=0.0, v_y=0.0, v_rot=0.0, dur=VELOCITY_CMD_DURATION):
    self._start_robot_command(
        desc,
        RobotCommandBuilder.synchro_velocity_command(v_x=v_x,
                                                     v_y=v_y,
                                                     v_rot=v_rot),
        end_time_secs=time.time() + dur)

  def _stow(self):
    self._start_robot_command('stow', RobotCommandBuilder.arm_stow_command())

  def _unstow(self):
    self._start_robot_command('stow', RobotCommandBuilder.arm_ready_command())

  def _return_to_origin(self):
    self._start_robot_command(
        'fwd_and_rotate',
        RobotCommandBuilder.synchro_se2_trajectory_point_command(
            goal_x=0.0,
            goal_y=0.0,
            goal_heading=0.0,
            frame_name=ODOM_FRAME_NAME,
            params=None,
            body_height=0.0,
            locomotion_hint=spot_command_pb2.HINT_SPEED_SELECT_TROT),
        end_time_secs=time.time() + 20)

  def _toggle_power(self):
    power_state = self._power_state()
    if power_state is None:
      self.add_message('Could not toggle power because power state is unknown')
      return

    if power_state == robot_state_proto.PowerState.STATE_OFF:
      self._try_grpc('powering-on', self._request_power_on)
    else:
      self._try_grpc('powering-off', self._safe_power_off)

  def _request_power_on(self):
    request = PowerServiceProto.PowerCommandRequest.REQUEST_ON
    return self._power_client.power_command(request)

  def _safe_power_off(self):
    self._start_robot_command('safe_power_off',
                              RobotCommandBuilder.safe_power_off_command())

  def _power_state(self):
    state = self.robot_state
    if not state:
      return None
    return state.power_state.motor_power_state

  def _lease_str(self, lease_keep_alive):
    if lease_keep_alive is None:
      alive = 'STOPPED'
      lease = 'RETURNED'
    else:
      try:
        _lease = lease_keep_alive.lease_wallet.get_lease()
        lease = f'{_lease.lease_proto.resource}:{_lease.lease_proto.sequence}'
      except bosdyn.client.lease.Error:
        lease = '...'
      if lease_keep_alive.is_alive():
        alive = 'RUNNING'
      else:
        alive = 'STOPPED'
    return f'Lease {lease} THREAD:{alive}'

  def _power_state_str(self):
    power_state = self._power_state()
    if power_state is None:
      return ''
    state_str = robot_state_proto.PowerState.MotorPowerState.Name(power_state)
    return f'Power: {state_str[6:]}'  # get rid of STATE_ prefix

  def _estop_str(self):
    if not self._estop_client:
      thread_status = 'NOT ESTOP'
    else:
      thread_status = 'RUNNING' if self._estop_keepalive else 'STOPPED'
    estop_status = '??'
    state = self.robot_state
    if state:
      for estop_state in state.estop_states:
        if estop_state.type == estop_state.TYPE_SOFTWARE:
          estop_status = estop_state.State.Name(
              estop_state.state)[6:]  # s/STATE_//
          break
    return f'Estop {estop_status} (thread: {thread_status})'

  def _time_sync_str(self):
    if not self._robot.time_sync:
      return 'Time sync: (none)'
    if self._robot.time_sync.stopped:
      status = 'STOPPED'
      exception = self._robot.time_sync.thread_exception
      if exception:
        status = f'{status} Exception: {exception}'
    else:
      status = 'RUNNING'
    try:
      skew = self._robot.time_sync.get_robot_clock_skew()
      if skew:
        skew_str = f'offset={duration_str(skew)}'
      else:
        skew_str = '(Skew undetermined)'
    except (TimeSyncError, RpcError) as err:
      skew_str = f'({err})'
    return f'Time sync: {status} {skew_str}'


def _setup_logging(verbose):
  """Log to file at debug level, and log to console at INFO or DEBUG (if verbose).

    Returns the stream/console logger so that it can be removed when in curses mode.
    """
  LOGGER.setLevel(logging.DEBUG)
  log_formatter = logging.Formatter(
      '%(asctime)s - %(levelname)s - %(message)s')

  # Save log messages to file wasd.log for later debugging.
  file_handler = logging.FileHandler('wasd.log')
  file_handler.setLevel(logging.DEBUG)
  file_handler.setFormatter(log_formatter)
  LOGGER.addHandler(file_handler)

  # The stream handler is useful before and after the application is in curses-mode.
  if verbose:
    stream_level = logging.DEBUG
  else:
    stream_level = logging.INFO

  stream_handler = logging.StreamHandler()
  stream_handler.setLevel(stream_level)
  stream_handler.setFormatter(log_formatter)
  LOGGER.addHandler(stream_handler)
  return stream_handler


def main():
  """Command-line interface."""
  import argparse

  parser = argparse.ArgumentParser()
  bosdyn.client.util.add_base_arguments(parser)
  parser.add_argument(
      '--time-sync-interval-sec',
      help='The interval (seconds) that time-sync estimate should be updated.',
      type=float)
  options = parser.parse_args()

  stream_handler = _setup_logging(options.verbose)

  # Create robot object.
  sdk = create_standard_sdk('WASDClient')
  robot = sdk.create_robot(options.hostname)
  try:
    bosdyn.client.util.authenticate(robot)
    robot.start_time_sync(options.time_sync_interval_sec)
  except RpcError as err:
    LOGGER.error('Failed to communicate with robot: %s', err)
    return False

  wasd_interface = WasdInterface(robot)
  try:
    wasd_interface.start()
  except (ResponseError, RpcError) as err:
    LOGGER.error('Failed to initialize robot communication: %s', err)
    return False

  LOGGER.removeHandler(
      stream_handler)  # Don't use stream handler in curses mode.

  try:
    try:
      # Prevent curses from introducing a 1 second delay for ESC key
      os.environ.setdefault('ESCDELAY', '0')
      # Run wasd interface in curses mode, then restore terminal config.
      wasd_interface.drive()
    finally:
      # Restore stream handler to show any exceptions or final messages.
      LOGGER.addHandler(stream_handler)
  except Exception as e:
    LOGGER.error('WASD has thrown an error: [%r] %s', e, e)
  finally:
    # Do any final cleanup steps.
    wasd_interface.shutdown()

  return True


if __name__ == '__main__':
  if not main():
    os._exit(1)
  os._exit(0)
