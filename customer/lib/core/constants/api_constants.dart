class ApiConstants {
  // API_BASE_URL is the production/build-time override.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  // Production API URL when API_BASE_URL is not set and we are in release mode.
  static const String productionUrl = 'http://10.94.228.5:5001/api';

  static const List<String> fallbackBaseUrls = [
    // Current development machine LAN/USB adapter addresses.
    'http://localhost:5001/api', // USB connected device (adb reverse)
    'http://10.94.228.5:5001/api', // Current PC Wi-Fi IP
    'http://172.20.10.6:5001/api', // PC LAN IP (Wi-Fi)
    'http://127.0.0.1:5001/api',
  ];
}
