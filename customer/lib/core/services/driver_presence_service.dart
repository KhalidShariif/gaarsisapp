import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../utils/api_service.dart';

class DriverPresenceService with WidgetsBindingObserver {
  DriverPresenceService._();

  static final DriverPresenceService instance = DriverPresenceService._();

  Timer? _heartbeatTimer;
  io.Socket? _socket;
  bool _isStarted = false;
  bool _isSendingHeartbeat = false;
  bool _observerRegistered = false;

  bool get isActive => _isStarted;

  Future<void> startIfDriver() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    final role = prefs.getString('user_role');
    if (token == null || token.isEmpty || role != 'driver') {
      return;
    }

    await start();
  }

  Future<void> start() async {
    if (_isStarted) {
      await _sendHeartbeat();
      return;
    }

    _isStarted = true;
    _registerObserver();
    unawaited(_connectSocket());
    await _sendHeartbeat();
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => _sendHeartbeat(),
    );
  }

  Future<void> setOnline(bool online) async {
    if (online) {
      await start();
      return;
    }

    await stop(markOffline: true);
  }

  Future<void> stop({bool markOffline = true}) async {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    _isStarted = false;

    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;

    if (markOffline) {
      try {
        await ApiService.patch('/driver/online-status', {'is_online': false});
      } catch (e) {
        debugPrint('Driver offline update skipped: $e');
      }
    }
  }

  void _registerObserver() {
    if (_observerRegistered) return;
    WidgetsBinding.instance.addObserver(this);
    _observerRegistered = true;
  }

  Future<void> _connectSocket() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (token == null || token.isEmpty) return;

    final socketUrl = ApiService.baseUrl.replaceFirst('/api', '');
    _socket?.dispose();
    _socket = io.io(
      socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .disableAutoConnect()
          .build(),
    );

    _socket!
      ..onConnect((_) {
        debugPrint('Driver socket connected.');
        _socket?.emit('heartbeat');
      })
      ..onDisconnect((_) => debugPrint('Driver socket disconnected.'))
      ..onConnectError((error) => debugPrint('Driver socket error: $error'))
      ..on('force-logout', (_) => _handleForcedLogout())
      ..connect();
  }

  Future<void> _sendHeartbeat() async {
    if (!_isStarted || _isSendingHeartbeat) return;
    _isSendingHeartbeat = true;

    try {
      final response = await ApiService.patch('/auth/heartbeat', {});
      if (response.statusCode == 401 || response.statusCode == 403) {
        await _handleExpiredSession();
        return;
      }

      if (_socket?.connected == true) {
        _socket?.emit('heartbeat');
      } else {
        unawaited(_connectSocket());
      }
    } catch (e) {
      debugPrint('Driver heartbeat failed: $e');
    } finally {
      _isSendingHeartbeat = false;
    }
  }

  Future<void> _handleExpiredSession() async {
    await stop(markOffline: false);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user_role');
    await prefs.remove('user_data');
  }

  Future<void> _handleForcedLogout() async {
    await _handleExpiredSession();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(startIfDriver());
    }
    if (state == AppLifecycleState.detached) {
      unawaited(stop(markOffline: false));
    }
  }
}
