class ApiConstants {
  // API_BASE_URL is the production/build-time override.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  // Production API URL when API_BASE_URL is not set and we are in release mode.
  static const String productionUrl = 'http://172.20.10.6:5001/api';

  static const List<String> fallbackBaseUrls = [
    // ✅ Active Cloudflare tunnel — works on any network (WiFi or mobile data)
    'https://power-way-cooked-draw.trycloudflare.com/api',
    // Current development machine LAN/USB adapter addresses.
    'http://10.212.216.76:5001/api', // Current active Ethernet IP
    'http://172.20.10.6:5001/api', // Current PC Wi-Fi IP
    'http://localhost:5001/api', // USB connected device (adb reverse)
    'http://10.94.228.5:5001/api', // Previous PC Wi-Fi IP
    'http://127.0.0.1:5001/api',
  ];
}
