import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/map_tile_config.dart';
import '../../../../core/routes/app_routes.dart';
import '../../../../core/utils/api_service.dart';
import '../../../../shared/widgets/custom_button.dart';

class SelectDeliveryLocationScreen extends StatefulWidget {
  const SelectDeliveryLocationScreen({super.key});

  @override
  State<SelectDeliveryLocationScreen> createState() =>
      _SelectDeliveryLocationScreenState();
}

class _SelectDeliveryLocationScreenState
    extends State<SelectDeliveryLocationScreen> {
  static const LatLng _mogadishu = LatLng(2.0469, 45.3182);

  final MapController _mapController = MapController();
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final List<Map<String, dynamic>> _deliveryPoints = [];
  Timer? _reverseGeocodeTimer;

  LatLng _selectedPoint = _mogadishu;
  double _zoom = 14;
  String _address = 'Mogadishu';
  String _area = 'Mogadishu';
  String _city = 'Mogadishu';
  bool _isLocating = true;
  bool _isSaving = false;
  bool _mapReady = false;

  @override
  void initState() {
    super.initState();
    _loadLocation();
  }

  @override
  void dispose() {
    _reverseGeocodeTimer?.cancel();
    _searchController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _loadLocation() async {
    LatLng? savedPoint;
    try {
      final profileResponse = await ApiService.get('/customer/profile');
      if (profileResponse.statusCode == 200) {
        final profile =
            jsonDecode(profileResponse.body) as Map<String, dynamic>;
        _phoneController.text = (profile['phone'] ?? '').toString();
      }
      final response = await ApiService.get('/customer/location');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final lat = double.tryParse(data['latitude']?.toString() ?? '');
        final lng = double.tryParse(data['longitude']?.toString() ?? '');
        if (lat != null && lng != null) {
          savedPoint = LatLng(lat, lng);
          _address = (data['address'] ?? 'Mogadishu').toString();
          _area = (data['area'] ?? data['city'] ?? 'Mogadishu').toString();
          _city = (data['city'] ?? 'Mogadishu').toString();
        }
      }
    } catch (e) {
      debugPrint('Saved customer location unavailable: $e');
    }

    if (savedPoint != null && mounted) {
      setState(() => _selectedPoint = savedPoint!);
    }

    await _moveToCurrentLocation(showPermissionMessage: false);
    if (mounted) setState(() => _isLocating = false);
  }

  Future<bool> _ensureLocationPermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      _showMessage('Turn on Location Services to use your current position.');
      return false;
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      _showMessage('Location permission was denied.');
      return false;
    }
    if (permission == LocationPermission.deniedForever) {
      _showMessage('Enable location permission from Android settings.');
      return false;
    }
    return true;
  }

  Future<void> _moveToCurrentLocation({
    bool showPermissionMessage = true,
  }) async {
    try {
      if (!await _ensureLocationPermission()) return;
      if (mounted) setState(() => _isLocating = true);
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      ).timeout(const Duration(seconds: 12));
      final point = LatLng(position.latitude, position.longitude);
      if (!mounted) return;
      setState(() {
        _selectedPoint = point;
        _zoom = 16;
      });
      if (_mapReady) _mapController.move(point, _zoom);
      await _reverseGeocode(point);
    } on TimeoutException {
      if (showPermissionMessage) {
        _showMessage('GPS took too long. Move outdoors and try again.');
      }
    } catch (e) {
      debugPrint('Current location unavailable: $e');
      if (showPermissionMessage) {
        _showMessage('Could not get your current location.');
      }
    } finally {
      if (mounted) setState(() => _isLocating = false);
    }
  }

  void _scheduleReverseGeocode(LatLng point) {
    _reverseGeocodeTimer?.cancel();
    _reverseGeocodeTimer = Timer(
      const Duration(milliseconds: 650),
      () => _reverseGeocode(point),
    );
  }

  Future<void> _reverseGeocode(LatLng point) async {
    try {
      final uri = Uri.https('nominatim.openstreetmap.org', '/reverse', {
        'format': 'jsonv2',
        'lat': point.latitude.toString(),
        'lon': point.longitude.toString(),
        'zoom': '18',
        'addressdetails': '1',
      });
      final response = await http
          .get(uri, headers: const {'User-Agent': 'DiyaarDeliveryApp/1.0'})
          .timeout(const Duration(seconds: 8));
      if (response.statusCode != 200 || !mounted) return;

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final addressData = Map<String, dynamic>.from(
        (data['address'] as Map?) ?? const {},
      );
      final city =
          (addressData['city'] ??
                  addressData['town'] ??
                  addressData['village'] ??
                  addressData['state'] ??
                  'Mogadishu')
              .toString();
      final area =
          (addressData['suburb'] ??
                  addressData['neighbourhood'] ??
                  addressData['city_district'] ??
                  city)
              .toString();
      setState(() {
        _address = (data['display_name'] ?? '$area, $city').toString();
        _area = area;
        _city = city;
      });
    } catch (e) {
      debugPrint('Reverse geocoding skipped: $e');
    }
  }

  Future<void> _searchAddress(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return;
    try {
      setState(() => _isLocating = true);
      final uri = Uri.https('nominatim.openstreetmap.org', '/search', {
        'format': 'jsonv2',
        'q': trimmed,
        'limit': '1',
        'addressdetails': '1',
      });
      final response = await http
          .get(uri, headers: const {'User-Agent': 'DiyaarDeliveryApp/1.0'})
          .timeout(const Duration(seconds: 8));
      final results = jsonDecode(response.body);
      if (response.statusCode != 200 || results is! List || results.isEmpty) {
        _showMessage('Address not found.');
        return;
      }
      final result = Map<String, dynamic>.from(results.first as Map);
      final lat = double.tryParse(result['lat']?.toString() ?? '');
      final lng = double.tryParse(result['lon']?.toString() ?? '');
      if (lat == null || lng == null || !mounted) return;
      final point = LatLng(lat, lng);
      setState(() {
        _selectedPoint = point;
        _address = (result['display_name'] ?? trimmed).toString();
        _zoom = 16;
      });
      _mapController.move(point, _zoom);
      await _reverseGeocode(point);
    } catch (e) {
      _showMessage('Could not search for that address.');
    } finally {
      if (mounted) setState(() => _isLocating = false);
    }
  }

  Future<void> _confirmLocation() async {
    if (_isSaving) return;
    if (_phoneController.text.trim().isEmpty) {
      _showMessage('Enter a contact phone number for this delivery point.');
      return;
    }
    setState(() => _isSaving = true);
    try {
      final response = await ApiService.put('/customer/location', {
        'latitude': _selectedPoint.latitude,
        'longitude': _selectedPoint.longitude,
        'city': _city,
        'area': _area,
        'address': _address,
      });
      if (!mounted) return;
      if (response.statusCode != 200 && response.statusCode != 201) {
        _showMessage('Could not save delivery location.');
        return;
      }

      final rawArgs = ModalRoute.of(context)?.settings.arguments;
      final args = rawArgs is Map
          ? Map<String, dynamic>.from(rawArgs)
          : <String, dynamic>{};
      final destinations = [
        ..._deliveryPoints,
        {
          'address_line': _address,
          'phone': _phoneController.text.trim(),
          'latitude': _selectedPoint.latitude,
          'longitude': _selectedPoint.longitude,
        },
      ];
      final nextRoute = args['next_route']?.toString();
      Navigator.pushNamed(
        context,
        nextRoute != null && nextRoute.isNotEmpty
            ? nextRoute
            : AppRoutes.priceSummary,
        arguments: {
          ...args,
          'delivery_address': _address,
          'delivery_city': _city,
          'delivery_area': _area,
          'customer_latitude': _selectedPoint.latitude,
          'customer_longitude': _selectedPoint.longitude,
          'delivery_phone': _phoneController.text.trim(),
          'delivery_addresses': destinations,
        },
      );
    } catch (e) {
      _showMessage('Could not save delivery location.');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _addDeliveryPoint() {
    final phone = _phoneController.text.trim();
    if (phone.isEmpty) {
      _showMessage('Enter a contact phone number first.');
      return;
    }
    setState(() {
      _deliveryPoints.add({
        'address_line': _address,
        'phone': phone,
        'latitude': _selectedPoint.latitude,
        'longitude': _selectedPoint.longitude,
      });
      _phoneController.clear();
    });
    _showMessage('Delivery point added. Select the next point on the map.');
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final textPrimary = theme.colorScheme.onSurface;
    final textSecondary = isDark
        ? AppColors.textSecondaryDark
        : AppColors.textSecondary;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _selectedPoint,
              initialZoom: _zoom,
              onMapReady: () {
                _mapReady = true;
                _mapController.move(_selectedPoint, _zoom);
              },
              onPositionChanged: (camera, hasGesture) {
                _zoom = camera.zoom;
                if (!hasGesture) return;
                setState(() => _selectedPoint = camera.center);
                _scheduleReverseGeocode(camera.center);
              },
            ),
            children: [
              TileLayer(
                urlTemplate: MapTileConfig.urlTemplate,
                subdomains: MapTileConfig.subdomains,
                userAgentPackageName: 'com.example.deliveryapp',
              ),
            ],
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.m),
              child: Column(
                children: [
                  Row(
                    children: [
                      _buildFloatingIcon(
                        context,
                        Icons.arrow_back,
                        onPressed: () => Navigator.pop(context),
                      ),
                      Expanded(
                        child: Text(
                          'Set Delivery Location',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: textPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            shadows: const [
                              Shadow(color: Colors.white, blurRadius: 8),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 44),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.m),
                  _buildSearchBar(context),
                ],
              ),
            ),
          ),
          Center(
            child: IgnorePointer(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text(
                      'DELIVER HERE',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const Icon(
                    Icons.location_on,
                    color: AppColors.primary,
                    size: 48,
                    shadows: [Shadow(color: Colors.black38, blurRadius: 8)],
                  ),
                  const SizedBox(height: 48),
                ],
              ),
            ),
          ),
          Positioned(
            right: 16,
            top: MediaQuery.sizeOf(context).height * 0.42,
            child: Column(
              children: [
                _buildFloatingIcon(
                  context,
                  Icons.add,
                  onPressed: () {
                    _zoom = (_zoom + 1).clamp(3, 19).toDouble();
                    _mapController.move(_selectedPoint, _zoom);
                  },
                ),
                const SizedBox(height: 8),
                _buildFloatingIcon(
                  context,
                  Icons.remove,
                  onPressed: () {
                    _zoom = (_zoom - 1).clamp(3, 19).toDouble();
                    _mapController.move(_selectedPoint, _zoom);
                  },
                ),
                const SizedBox(height: 16),
                _buildFloatingIcon(
                  context,
                  Icons.my_location,
                  isPrimary: true,
                  onPressed: _moveToCurrentLocation,
                ),
              ],
            ),
          ),
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.l),
              decoration: BoxDecoration(
                color: theme.scaffoldBackgroundColor,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(28),
                ),
                boxShadow: const [
                  BoxShadow(color: Colors.black26, blurRadius: 24),
                ],
              ),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withAlpha(24),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(
                            Icons.location_on,
                            color: AppColors.primary,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _isLocating
                                    ? 'LOCATING...'
                                    : 'CURRENT SELECTION',
                                style: TextStyle(
                                  color: textSecondary,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _area,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: textPrimary,
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              Text(
                                _address,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: textSecondary,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.l),
                    TextField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'Phone number for this delivery point',
                        prefixIcon: Icon(Icons.phone_outlined),
                      ),
                    ),
                    if (_deliveryPoints.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        '${_deliveryPoints.length} additional delivery point(s) added',
                        style: TextStyle(color: textSecondary, fontSize: 12),
                      ),
                    ],
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: _isSaving ? null : _addDeliveryPoint,
                      icon: const Icon(Icons.add_location_alt_outlined),
                      label: const Text('Add Another Delivery Point'),
                    ),
                    const SizedBox(height: AppSpacing.m),
                    CustomButton(
                      text: _isSaving ? 'Saving...' : 'Confirm Location',
                      onPressed: _isSaving ? null : _confirmLocation,
                      icon: const Icon(
                        Icons.arrow_forward,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFloatingIcon(
    BuildContext context,
    IconData icon, {
    VoidCallback? onPressed,
    bool isPrimary = false,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: isPrimary
            ? AppColors.primary
            : (isDark ? AppColors.surfaceDark : Colors.white),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.black12),
        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 10)],
      ),
      child: IconButton(
        padding: EdgeInsets.zero,
        onPressed: onPressed,
        icon: Icon(
          icon,
          color: isPrimary ? Colors.white : theme.colorScheme.onSurface,
          size: 20,
        ),
      ),
    );
  }

  Widget _buildSearchBar(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      height: 54,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.black12),
        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 14)],
      ),
      child: Row(
        children: [
          const Icon(Icons.search, color: Colors.grey, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: _searchController,
              onSubmitted: _searchAddress,
              textInputAction: TextInputAction.search,
              style: TextStyle(color: theme.colorScheme.onSurface),
              decoration: const InputDecoration(
                hintText: 'Enter street address or landmark',
                hintStyle: TextStyle(color: Colors.grey, fontSize: 14),
                border: InputBorder.none,
              ),
            ),
          ),
          if (_isLocating)
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
        ],
      ),
    );
  }
}
