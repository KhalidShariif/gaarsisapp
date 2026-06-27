import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/map_tile_config.dart';
import '../../../../core/utils/api_service.dart';
import '../../../../shared/widgets/custom_button.dart';
import '../../../../core/theme/theme_provider.dart';

class DeliveryDetailsScreen extends StatefulWidget {
  const DeliveryDetailsScreen({super.key});

  @override
  State<DeliveryDetailsScreen> createState() => _DeliveryDetailsScreenState();
}

class _DeliveryDetailsScreenState extends State<DeliveryDetailsScreen> {
  dynamic _delivery;
  bool _isLoading = true;
  bool _isUpdating = false;
  String? _updatingStatus;
  StreamSubscription<Position>? _positionStream;
  Timer? _locationSyncTimer;
  Position? _lastKnownPosition;
  bool _isLocationSyncing = false;
  final MapController _mapController = MapController();
  final Distance _distance = const Distance();
  static const List<String> _statusFlow = [
    'pending',
    'assigned',
    'heading_to_vendor',
    'picked_up',
    'on_the_way',
    'arrived',
    'delivered',
  ];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final deliveryId = ModalRoute.of(context)?.settings.arguments;
    if (deliveryId != null && _delivery == null) {
      _fetchDetails(deliveryId);
    }
  }

  @override
  void dispose() {
    _stopLocationUpdates();
    super.dispose();
  }

  Future<void> _fetchDetails(dynamic id) async {
    if (mounted) setState(() => _isLoading = true);
    try {
      final response = await ApiService.get('/driver/deliveries/$id');
      if (response.statusCode == 200) {
        if (mounted) {
          setState(() {
            _delivery = jsonDecode(response.body);
          });
        }
        print('DEBUG: Delivery details refreshed. Status: ${_currentStatus()}');
        if (_shouldStreamLocation(_currentStatus())) {
          _startLocationUpdates();
        } else {
          _stopLocationUpdates();
        }
      }
    } catch (e) {
      print('Error fetching delivery details: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _startLocationUpdates() async {
    if (_positionStream != null && _locationSyncTimer != null) return;

    try {
      final canUseLocation = await _ensureLocationReady(
        actionName: 'track this delivery',
      );
      if (!canUseLocation) {
        return;
      }

      // Android foreground service keeps live delivery tracking active while the app is backgrounded.
      final locationSettings = AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 0,
        intervalDuration: const Duration(seconds: 5),
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationText: 'Delivery tracking is active in the background.',
          notificationTitle: 'Live Tracking',
          enableWakeLock: true,
        ),
      );

      _positionStream ??=
          Geolocator.getPositionStream(
            locationSettings: locationSettings,
          ).listen((Position position) {
            _lastKnownPosition = position;
            _updateLiveLocation(position);
          }, onError: (e) => print('DEBUG: Location stream error: $e'));

      _locationSyncTimer ??= Timer.periodic(
        const Duration(seconds: 5),
        (_) => _syncLatestLocation(),
      );
      unawaited(_syncLatestLocation(forceRefresh: true));
      print('DEBUG: GPS live tracking started with 5-second sync.');
    } on PlatformException catch (e) {
      print('DEBUG: Location start PlatformException: ${e.message}');
      _showLocationSnackBar(_locationPlatformMessage(e));
    } catch (e) {
      print('DEBUG: Location start failed: $e');
      _showLocationSnackBar(
        'Unable to start live GPS tracking. Please try again.',
      );
    }
  }

  void _stopLocationUpdates() {
    _positionStream?.cancel();
    _positionStream = null;
    _locationSyncTimer?.cancel();
    _locationSyncTimer = null;
    _isLocationSyncing = false;
  }

  Future<void> _syncLatestLocation({bool forceRefresh = false}) async {
    if (_isLocationSyncing || !_shouldStreamLocation(_currentStatus())) return;

    _isLocationSyncing = true;
    try {
      var position = _lastKnownPosition;
      if (forceRefresh || position == null) {
        position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
          ),
        ).timeout(const Duration(seconds: 10));
        _lastKnownPosition = position;
      }

      await _updateLiveLocation(position);
    } on PlatformException catch (e) {
      print('DEBUG: Timed GPS sync PlatformException: ${e.message}');
    } on TimeoutException {
      print('DEBUG: Timed GPS sync timed out.');
    } catch (e) {
      print('DEBUG: Timed GPS sync failed: $e');
    } finally {
      _isLocationSyncing = false;
    }
  }

  Future<void> _updateLiveLocation(Position position) async {
    if (mounted) {
      setState(() {
        final deliveryDetails = Map<String, dynamic>.from(
          (_delivery?['delivery'] as Map?) ?? const {},
        );
        deliveryDetails['driver_latitude'] = position.latitude;
        deliveryDetails['driver_longitude'] = position.longitude;
        _delivery = {...?_delivery, 'delivery': deliveryDetails};
      });
    }

    try {
      await ApiService.put('/drivers/location', {
        'delivery_id': _delivery['id'],
        'latitude': position.latitude,
        'longitude': position.longitude,
        'heading': position.heading.isFinite ? position.heading : null,
        'speed': position.speed.isFinite ? position.speed : null,
      });
    } catch (e) {
      print('Location Update Error: $e');
    }
  }

  double? _firstCoordinate(List<dynamic> values) {
    for (final value in values) {
      final parsed = double.tryParse(value?.toString() ?? '');
      if (parsed != null && parsed.isFinite) return parsed;
    }
    return null;
  }

  LatLng? _pointFromValues(List<dynamic> latValues, List<dynamic> lngValues) {
    final lat = _firstCoordinate(latValues);
    final lng = _firstCoordinate(lngValues);
    if (lat == null || lng == null) return null;
    if (lat.abs() < 0.000001 && lng.abs() < 0.000001) return null;
    return LatLng(lat, lng);
  }

  LatLng _centerForPoints(List<LatLng> points) {
    if (points.isEmpty) return const LatLng(2.0469, 45.3182);
    final lat =
        points.map((p) => p.latitude).reduce((a, b) => a + b) / points.length;
    final lng =
        points.map((p) => p.longitude).reduce((a, b) => a + b) / points.length;
    return LatLng(lat, lng);
  }

  LatLng? _targetPointForStatus(
    String status,
    LatLng? customerPoint,
    LatLng? vendorPoint,
  ) {
    switch (_canonicalStatus(status)) {
      case 'assigned':
      case 'heading_to_vendor':
        return vendorPoint ?? customerPoint;
      case 'picked_up':
      case 'on_the_way':
      case 'arrived':
        return customerPoint ?? vendorPoint;
      default:
        return customerPoint ?? vendorPoint;
    }
  }

  String _targetLabelForStatus(String status) {
    switch (_canonicalStatus(status)) {
      case 'assigned':
      case 'heading_to_vendor':
        return 'To Vendor';
      case 'arrived':
        return 'At Customer';
      default:
        return 'To Customer';
    }
  }

  double? _remainingDistanceMeters(LatLng? driverPoint, LatLng? targetPoint) {
    if (driverPoint == null || targetPoint == null) return null;
    return _distance.as(LengthUnit.Meter, driverPoint, targetPoint);
  }

  String _formatMapDistance(double? meters) {
    if (meters == null || !meters.isFinite) return '--';
    if (meters < 1000) return '${meters.round()} m';
    return '${(meters / 1000).toStringAsFixed(1)} km';
  }

  String _formatMapEta(double? meters, String status) {
    if (_canonicalStatus(status) == 'arrived') return 'Arrived';
    if (meters == null || !meters.isFinite) return '--';
    final minutes = (meters / 416).ceil().clamp(1, 99);
    return '$minutes min';
  }

  String _currentStatus() {
    return (_delivery?['status'] ??
            _delivery?['delivery']?['status'] ??
            _delivery?['delivery_status'] ??
            'assigned')
        .toString();
  }

  String _canonicalStatus(String status) {
    switch (status.toLowerCase().trim()) {
      case 'accepted':
        return 'heading_to_vendor';
      case 'driver assigned':
        return 'assigned';
      case 'on the way':
        return 'on_the_way';
      default:
        return status;
    }
  }

  bool _shouldStreamLocation(String status) {
    return const {
      'assigned',
      'accepted',
      'heading_to_vendor',
      'picked_up',
      'on_the_way',
      'arrived',
    }.contains(_canonicalStatus(status));
  }

  bool _canTransitionTo(String nextStatus) {
    final currentIndex = _statusFlow.indexOf(
      _canonicalStatus(_currentStatus()),
    );
    final nextIndex = _statusFlow.indexOf(nextStatus);
    return currentIndex >= 0 && nextIndex == currentIndex + 1;
  }

  String _extractErrorMessage(dynamic body, int statusCode) {
    try {
      final decoded = jsonDecode(body.toString());
      return (decoded['message'] ?? decoded['error'] ?? 'Request failed')
          .toString();
    } catch (_) {
      if (statusCode == 401 || statusCode == 403) {
        return 'Your session expired. Please log in again.';
      }
      if (statusCode == 409) {
        return 'This delivery was already updated. Please refresh.';
      }
      return 'Request failed. Please try again.';
    }
  }

  String _locationPlatformMessage(PlatformException error) {
    if (error.code == 'PERMISSION_DEFINITIONS_NOT_FOUND') {
      return 'Location permission is not available in this app build. Please reinstall the latest build.';
    }
    return 'Location error: ${error.message ?? error.code}';
  }

  void _showLocationSnackBar(
    String message, {
    bool openAppSettings = false,
    bool openLocationSettings = false,
  }) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(seconds: 6),
        action: (openAppSettings || openLocationSettings)
            ? SnackBarAction(
                label: 'Settings',
                onPressed: () {
                  if (openAppSettings) {
                    Geolocator.openAppSettings();
                  } else {
                    Geolocator.openLocationSettings();
                  }
                },
              )
            : null,
      ),
    );
  }

  Future<bool> _ensureLocationReady({required String actionName}) async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        print('DEBUG: GPS unavailable: location services disabled.');
        _showLocationSnackBar(
          'GPS is disabled. Turn on Location Services to $actionName.',
          openLocationSettings: true,
        );
        return false;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied) {
        print('DEBUG: GPS unavailable: location permission denied.');
        _showLocationSnackBar(
          'Location permission denied. Allow location access to $actionName.',
        );
        return false;
      }

      if (permission == LocationPermission.deniedForever) {
        print(
          'DEBUG: GPS unavailable: location permission permanently denied.',
        );
        _showLocationSnackBar(
          'Location permission is permanently denied. Open app settings and allow location access.',
          openAppSettings: true,
        );
        return false;
      }

      return true;
    } on PlatformException catch (e) {
      print(
        'DEBUG: GPS permission PlatformException: ${e.code} - ${e.message}',
      );
      _showLocationSnackBar(_locationPlatformMessage(e));
      return false;
    }
  }

  Future<Position?> _getCurrentPositionForPickup() async {
    try {
      final canUseLocation = await _ensureLocationReady(
        actionName: 'pick up orders',
      );
      if (!canUseLocation) {
        return null;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      ).timeout(const Duration(seconds: 12));
      _lastKnownPosition = position;
      return position;
    } on PlatformException catch (e) {
      // Handles: manifest missing permissions, service not available, etc.
      print('DEBUG: Pickup GPS PlatformException: ${e.code} - ${e.message}');
      _showLocationSnackBar(_locationPlatformMessage(e));
      return null;
    } on TimeoutException {
      print('DEBUG: Pickup GPS timed out.');
      _showLocationSnackBar(
        'Could not get your GPS location. Move to an open area and try again.',
      );
      return null;
    } catch (e) {
      print('DEBUG: Pickup GPS unavailable: $e');
      _showLocationSnackBar(
        'Could not get your GPS location. Please try again.',
      );
      return null;
    }
  }

  Future<void> _updateStatus(String status) async {
    if (_isUpdating) return;
    if (!_canTransitionTo(status) &&
        status != 'failed' &&
        status != 'accepted' &&
        status != 'rejected') {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Cannot change status from ${_currentStatus()} to $status.',
            ),
          ),
        );
      }
      return;
    }

    print(
      'DEBUG: Status button clicked. Current=${_currentStatus()}, Next=$status',
    );
    if (mounted) {
      setState(() {
        _isUpdating = true;
        _updatingStatus = status;
      });
    }
    try {
      String endpoint = '/driver/deliveries/${_delivery['id']}/status';
      if (status == 'heading_to_vendor') {
        endpoint = '/driver/deliveries/${_delivery['id']}/status';
      }
      if (status == 'picked_up') {
        endpoint = '/driver/deliveries/${_delivery['id']}/pickup';
      }
      if (status == 'on_the_way') {
        endpoint = '/driver/deliveries/${_delivery['id']}/on-the-way';
      }
      if (status == 'arrived') {
        endpoint = '/driver/deliveries/${_delivery['id']}/arrived';
      }
      if (status == 'delivered') {
        endpoint = '/driver/deliveries/${_delivery['id']}/delivered';
      }
      if (status == 'accepted') {
        endpoint = '/driver/deliveries/${_delivery['id']}/accept';
      }
      if (status == 'rejected') {
        endpoint = '/driver/deliveries/${_delivery['id']}/reject';
      }

      final Map<String, dynamic> payload = {'status': status};
      if (status == 'arrived') {
        final position = await _getCurrentPositionForPickup();
        if (position != null) {
          payload['latitude'] = position.latitude;
          payload['longitude'] = position.longitude;
        } else {
          print(
            'DEBUG: Arrival GPS skipped; backend will validate last synced driver location.',
          );
        }
      }

      print('DEBUG: API request started PATCH $endpoint');
      final response = await ApiService.patch(endpoint, payload);
      print('DEBUG: API response ${response.statusCode}: ${response.body}');
      if (response.statusCode == 200) {
        // Always start/stop GPS based on resulting status
        if (_shouldStreamLocation(status)) {
          _startLocationUpdates();
        }
        if (status == 'delivered') _stopLocationUpdates();
        await _fetchDetails(_delivery['id']);
        print('DEBUG: Updated delivery status: ${_currentStatus()}');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Delivery updated to ${status.replaceAll('_', ' ')}.',
              ),
            ),
          );
        }
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _extractErrorMessage(response.body, response.statusCode),
            ),
          ),
        );
      }
    } catch (e) {
      print('DEBUG: Status update failed: $e');
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUpdating = false;
          _updatingStatus = null;
        });
      }
    }
  }

  Future<void> _rejectDelivery() async {
    final shouldReject = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Reject Order'),
        content: const Text('Are you sure you want to reject this order?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    if (shouldReject != true) return;
    if (mounted) {
      setState(() {
        _isUpdating = true;
        _updatingStatus = 'rejected';
      });
    }
    try {
      final response = await ApiService.patch(
        '/driver/deliveries/${_delivery['id']}/reject',
        {
          'status': 'rejected',
          'rejection_reason': 'Rejected by delivery personnel',
        },
      );
      if (response.statusCode == 200 && mounted) Navigator.pop(context);
    } finally {
      if (mounted) {
        setState(() {
          _isUpdating = false;
          _updatingStatus = null;
        });
      }
    }
  }

  Future<void> _markPickedUp() async {
    if (_isUpdating) return;
    final currentStatus = _canonicalStatus(_currentStatus());
    print('DEBUG: Mark Picked Up clicked. Current status=$currentStatus');

    if (currentStatus == 'picked_up') {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('This order is already picked up.')),
        );
      }
      return;
    }

    if (currentStatus != 'heading_to_vendor') {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Cannot pick up order from $currentStatus status.'),
          ),
        );
      }
      return;
    }

    if (mounted) {
      setState(() {
        _isUpdating = true;
        _updatingStatus = 'picked_up';
      });
    }

    try {
      final position = await _getCurrentPositionForPickup();
      if (position == null) {
        print(
          'DEBUG: Pickup cancelled because GPS location was not available.',
        );
        return;
      }

      await _updateLiveLocation(position);

      final Map<String, dynamic> payload = {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'heading': position.heading.isFinite ? position.heading : null,
        'speed': position.speed.isFinite ? position.speed : null,
      };

      final endpoint = '/driver/deliveries/${_delivery['id']}/pickup';
      print('DEBUG: API request started PATCH $endpoint');
      final response = await ApiService.patch(endpoint, payload);
      print('DEBUG: API response ${response.statusCode}: ${response.body}');

      if (response.statusCode == 200) {
        _startLocationUpdates();
        await _fetchDetails(_delivery['id']);
        print('DEBUG: Updated delivery status: ${_currentStatus()}');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Order picked up successfully.')),
          );
        }
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _extractErrorMessage(response.body, response.statusCode),
            ),
          ),
        );
      }
    } catch (e) {
      print('DEBUG: Pickup failed: $e');
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUpdating = false;
          _updatingStatus = null;
        });
      }
    }
  }

  Future<void> _verifyCode() async {
    final TextEditingController codeController = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.backgroundDark,
        title: Text(
          'Enter Delivery Code',
          style: TextStyle(color: AppColors.textPrimaryDark),
        ),
        content: TextField(
          controller: codeController,
          keyboardType: TextInputType.number,
          maxLength: 6,
          style: TextStyle(
            color: AppColors.textPrimaryDark,
            fontSize: 24,
            letterSpacing: 8,
          ),
          decoration: InputDecoration(
            hintText: '000000',
            hintStyle: TextStyle(color: Colors.grey),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: const Text('Verify'),
          ),
        ],
      ),
    );

    if (result == true && codeController.text.length == 6) {
      if (mounted) setState(() => _isUpdating = true);
      try {
        final response = await ApiService.post(
          '/driver/deliveries/${_delivery['id']}/verify-code',
          {'code': codeController.text},
        );
        if (response.statusCode == 200) {
          _stopLocationUpdates();
          await _fetchDetails(_delivery['id']);
          if (mounted) {
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(const SnackBar(content: Text('Delivery Verified!')));
          }
        } else {
          final errorMsg =
              jsonDecode(response.body)['message'] ?? 'Invalid Code';
          if (mounted) {
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(SnackBar(content: Text(errorMsg)));
          }
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Error: $e')));
        }
      } finally {
        if (mounted) {
          setState(() => _isUpdating = false);
        }
      }
    }
  }

  Future<void> _uploadPhoto() async {
    final picker = ImagePicker();
    final XFile? photo = await picker.pickImage(source: ImageSource.camera);

    if (photo != null) {
      if (mounted) setState(() => _isUpdating = true);
      try {
        final response = await ApiService.post(
          '/driver/deliveries/${_delivery['id']}/upload-proof',
          {'image_url': 'https://example.com/proofs/${photo.name}'},
        );
        if (response.statusCode == 200) {
          _stopLocationUpdates();
          await _fetchDetails(_delivery['id']);
          if (mounted) {
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(const SnackBar(content: Text('Proof Uploaded!')));
          }
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Error: $e')));
        }
      } finally {
        if (mounted) {
          setState(() => _isUpdating = false);
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<ThemeProvider>(context); // listen for theme changes
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: AppColors.textPrimaryDark),
        ),
        title: Text(
          'Delivery Details',
          style: TextStyle(
            color: AppColors.textPrimaryDark,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _delivery == null
          ? Center(
              child: Text(
                'Failed to load delivery details',
                style: TextStyle(color: AppColors.textPrimaryDark),
              ),
            )
          : Builder(
              builder: (context) {
                final customerName =
                    (_delivery['customer_name'] ??
                            _delivery['customer']?['name'] ??
                            'Unknown Customer')
                        .toString();
                final phone =
                    (_delivery['phone'] ??
                            _delivery['customer']?['phone'] ??
                            _delivery['customer_phone'] ??
                            'No phone')
                        .toString();
                final destinations = List<Map<String, dynamic>>.from(
                  ((_delivery['destinations'] as List?) ?? const []).map(
                    (item) => Map<String, dynamic>.from(item as Map),
                  ),
                );
                final address =
                    (_delivery['address'] ??
                            _delivery['customer']?['address'] ??
                            _delivery['customer_address'] ??
                            'No address')
                        .toString();
                final vendorName =
                    (_delivery['vendor_name'] ??
                            _delivery['vendor']?['name'] ??
                            'Unknown Vendor')
                        .toString();
                final vendorAddress =
                    (_delivery['vendor_address'] ??
                            _delivery['vendor']?['address'] ??
                            'N/A')
                        .toString();

                return SingleChildScrollView(
                  padding: const EdgeInsets.all(AppSpacing.l),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildStatusCard(),
                      const SizedBox(height: AppSpacing.l),
                      _buildMapSection(),
                      const SizedBox(height: AppSpacing.xl),
                      _buildInfoSection('CUSTOMER INFO', [
                        _buildInfoRow(Icons.person, 'Name', customerName),
                        _buildInfoRow(Icons.phone, 'Phone', phone),
                        _buildInfoRow(Icons.location_on, 'Address', address),
                        ...destinations.map(
                          (destination) => _buildInfoRow(
                            Icons.phone_in_talk_outlined,
                            'Stop ${destination['sequence_no']} Contact',
                            '${destination['phone']} - ${destination['address_line']}',
                          ),
                        ),
                      ]),
                      const SizedBox(height: AppSpacing.xl),
                      _buildInfoSection('VENDOR INFO', [
                        _buildInfoRow(Icons.business, 'Station', vendorName),
                        _buildInfoRow(
                          Icons.map,
                          'Vendor Address',
                          vendorAddress,
                        ),
                      ]),
                      const SizedBox(height: AppSpacing.xl),
                      _buildItemsSection(),
                      const SizedBox(height: 40),
                      _buildActionButtons(),
                      const SizedBox(height: 32),
                    ],
                  ),
                );
              },
            ),
    );
  }

  Widget _buildMapSection() {
    final status = _canonicalStatus(
      (_delivery['delivery']?['status'] ?? _delivery['status'] ?? '')
          .toString(),
    );
    if (!{
      'assigned',
      'heading_to_vendor',
      'picked_up',
      'on_the_way',
      'arrived',
    }.contains(status)) {
      return const SizedBox.shrink();
    }

    final customerPoint = _pointFromValues(
      [
        _delivery['customer']?['latitude'],
        _delivery['customer_latitude'],
        _delivery['customer_lat'],
        _delivery['dest_lat'],
        _delivery['latitude'],
      ],
      [
        _delivery['customer']?['longitude'],
        _delivery['customer_longitude'],
        _delivery['customer_lng'],
        _delivery['dest_lng'],
        _delivery['longitude'],
      ],
    );
    final vendorPoint = _pointFromValues(
      [
        _delivery['vendor']?['latitude'],
        _delivery['vendor_latitude'],
        _delivery['vendor_lat'],
        _delivery['pickup_lat'],
      ],
      [
        _delivery['vendor']?['longitude'],
        _delivery['vendor_longitude'],
        _delivery['vendor_lng'],
        _delivery['pickup_lng'],
      ],
    );
    final driverPoint = _pointFromValues(
      [
        _delivery['delivery']?['driver_latitude'],
        _delivery['driver_latitude'],
        _delivery['driver_lat'],
        _delivery['current_latitude'],
        _delivery['current_lat'],
      ],
      [
        _delivery['delivery']?['driver_longitude'],
        _delivery['driver_longitude'],
        _delivery['driver_lng'],
        _delivery['current_longitude'],
        _delivery['current_lng'],
      ],
    );

    final targetPoint = _targetPointForStatus(
      status,
      customerPoint,
      vendorPoint,
    );
    final points = [
      if (driverPoint != null) driverPoint,
      if (targetPoint != null) targetPoint,
      if (customerPoint != null && customerPoint != targetPoint) customerPoint,
      if (vendorPoint != null && vendorPoint != targetPoint) vendorPoint,
    ];

    if (points.isEmpty) {
      return Container(
        height: 220,
        width: double.infinity,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.surfaceDark.withOpacity(0.35),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.borderDark),
        ),
        child: const Text(
          'Waiting for map location...',
          style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700),
        ),
      );
    }

    final routePoints = [
      if (driverPoint != null) driverPoint,
      if (targetPoint != null) targetPoint,
    ];
    final fitPoints = routePoints.length > 1 ? routePoints : points;
    final remainingMeters = _remainingDistanceMeters(driverPoint, targetPoint);
    final targetLabel = _targetLabelForStatus(status);

    final markers = <Marker>[
      if (vendorPoint != null)
        Marker(
          point: vendorPoint,
          width: 86,
          height: 64,
          child: _buildMapMarker(
            Icons.storefront,
            'Vendor',
            Colors.orangeAccent,
          ),
        ),
      if (customerPoint != null)
        Marker(
          point: customerPoint,
          width: 96,
          height: 64,
          child: _buildMapMarker(
            Icons.person_pin_circle,
            'Customer',
            Colors.redAccent,
          ),
        ),
      if (driverPoint != null)
        Marker(
          point: driverPoint,
          width: 86,
          height: 64,
          child: _buildMapMarker(
            Icons.local_shipping,
            'Driver',
            AppColors.primary,
          ),
        ),
    ];

    return Container(
      height: 292,
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderDark),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            ColoredBox(
              color: const Color(0xFFF4F7FA),
              child: FlutterMap(
                key: ValueKey(
                  'driver-map-$status-${driverPoint?.latitude}-${driverPoint?.longitude}-${targetPoint?.latitude}-${targetPoint?.longitude}',
                ),
                mapController: _mapController,
                options: MapOptions(
                  initialCenter: _centerForPoints(fitPoints),
                  initialZoom: fitPoints.length > 1 ? 14 : 15,
                  initialCameraFit: fitPoints.length > 1
                      ? CameraFit.bounds(
                          bounds: LatLngBounds.fromPoints(fitPoints),
                          padding: const EdgeInsets.fromLTRB(42, 42, 42, 94),
                        )
                      : null,
                ),
                children: [
                  TileLayer(
                    urlTemplate: MapTileConfig.urlTemplate,
                    subdomains: MapTileConfig.subdomains,
                    userAgentPackageName: 'com.deliveryapp.customer',
                    tileBuilder: MapTileConfig.needsColorInversion
                        ? darkModeTileBuilder
                        : null,
                  ),
                  if (routePoints.length > 1)
                    PolylineLayer(
                      polylines: [
                        Polyline(
                          points: routePoints,
                          color: AppColors.primary,
                          strokeWidth: 5,
                        ),
                      ],
                    ),
                  MarkerLayer(markers: markers),
                ],
              ),
            ),
            Positioned(
              left: 12,
              right: 12,
              bottom: 12,
              child: _buildMapMetricCard(
                targetLabel: targetLabel,
                distanceText: _formatMapDistance(remainingMeters),
                etaText: _formatMapEta(remainingMeters, status),
                hasDriverLocation: driverPoint != null,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMapMarker(IconData icon, String label, Color color) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(7),
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2),
            boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 8)],
          ),
          child: Icon(icon, color: Colors.white, size: 22),
        ),
        const SizedBox(height: 3),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.72),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMapMetricCard({
    required String targetLabel,
    required String distanceText,
    required String etaText,
    required bool hasDriverLocation,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.94),
        borderRadius: BorderRadius.circular(14),
        boxShadow: const [
          BoxShadow(
            color: Colors.black26,
            blurRadius: 12,
            offset: Offset(0, 5),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: hasDriverLocation
                  ? AppColors.primary.withOpacity(0.12)
                  : Colors.orange.withOpacity(0.14),
              shape: BoxShape.circle,
            ),
            child: Icon(
              hasDriverLocation ? Icons.navigation : Icons.gps_not_fixed,
              color: hasDriverLocation ? AppColors.primary : Colors.orange,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  hasDriverLocation ? targetLabel : 'Waiting for driver GPS',
                  style: const TextStyle(
                    color: Color(0xFF0F172A),
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  hasDriverLocation
                      ? '$distanceText remaining'
                      : 'Keep tracking open while location loads',
                  style: const TextStyle(
                    color: Color(0xFF64748B),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              etaText,
              style: const TextStyle(
                color: Color(0xFF1D4ED8),
                fontWeight: FontWeight.w900,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusCard() {
    final status =
        (_delivery['status'] ??
                _delivery['delivery']?['status'] ??
                _delivery['delivery_status'] ??
                'assigned')
            .toString();
    final color = _getStatusColor(status);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.l),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline, color: color),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Current Status',
                style: TextStyle(color: Colors.grey, fontSize: 12),
              ),
              Text(
                status.toUpperCase().replaceAll('_', ' '),
                style: TextStyle(
                  color: color,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoSection(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: Colors.grey,
            fontSize: 12,
            fontWeight: FontWeight.bold,
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surfaceDark.withOpacity(0.3),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.borderDark.withOpacity(0.3)),
          ),
          child: Column(children: children),
        ),
      ],
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, color: AppColors.primary, size: 18),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(color: Colors.grey, fontSize: 10),
              ),
              Text(
                value,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildItemsSection() {
    final List items = _delivery['items'] ?? [];
    return _buildInfoSection(
      'ORDERED ITEMS',
      items
          .map(
            (i) => _buildInfoRow(
              Icons.inventory_2,
              (i['product_name'] ?? 'Unknown').toString(),
              'Qty: ${(i['quantity'] ?? 0).toString()}',
            ),
          )
          .toList(),
    );
  }

  Widget _buildActionButtons() {
    final status =
        (_delivery['status'] ??
                _delivery['delivery']?['status'] ??
                _delivery['delivery_status'] ??
                'assigned')
            .toString();
    final canonicalStatus = _canonicalStatus(status);
    final isPickupLoading = _isUpdating && _updatingStatus == 'picked_up';

    if (canonicalStatus == 'pending') {
      return const Center(
        child: Text(
          'Waiting for assignment',
          style: TextStyle(color: Colors.grey),
        ),
      );
    }
    if (canonicalStatus == 'assigned') {
      return Column(
        children: [
          CustomButton(
            text: 'Accept Order',
            isLoading: _isUpdating && _updatingStatus == 'accepted',
            onPressed: _isUpdating ? null : () => _updateStatus('accepted'),
          ),
          const SizedBox(height: 12),
          CustomButton(
            text: 'Reject Order',
            isLoading: _isUpdating && _updatingStatus == 'rejected',
            onPressed: _isUpdating ? null : _rejectDelivery,
            backgroundColor: Colors.red,
            textColor: Colors.white,
          ),
        ],
      );
    }
    if (canonicalStatus == 'heading_to_vendor') {
      return CustomButton(
        text: 'Mark Picked Up',
        isLoading: isPickupLoading,
        onPressed: _isUpdating ? null : _markPickedUp,
      );
    }
    if (canonicalStatus == 'picked_up') {
      return CustomButton(
        text: 'Start Delivery',
        isLoading: _isUpdating && _updatingStatus == 'on_the_way',
        onPressed: _isUpdating ? null : () => _updateStatus('on_the_way'),
      );
    }

    // Delivery Confirmation Flow
    if (canonicalStatus == 'on_the_way') {
      return CustomButton(
        text: 'Arrived at Customer',
        isLoading: _isUpdating && _updatingStatus == 'arrived',
        onPressed: _isUpdating ? null : () => _updateStatus('arrived'),
      );
    }

    if (canonicalStatus == 'arrived') {
      return Column(
        children: [
          CustomButton(
            text: 'Confirm Delivery by Code',
            onPressed: _isUpdating ? null : _verifyCode,
            backgroundColor: AppColors.primary,
          ),
          const SizedBox(height: 12),
          CustomButton(
            text: 'Take Delivery Photo',
            onPressed: _isUpdating ? null : _uploadPhoto,
            backgroundColor: AppColors.surfaceDark,
            textColor: Colors.white,
          ),
        ],
      );
    }
    return const Center(
      child: Text('Delivery Completed', style: TextStyle(color: Colors.grey)),
    );
  }

  Color _getStatusColor(String status) {
    switch (_canonicalStatus(status)) {
      case 'assigned':
        return Colors.blue;
      case 'heading_to_vendor':
        return Colors.lightBlue;
      case 'picked_up':
        return Colors.orange;
      case 'on_the_way':
        return Colors.amber;
      case 'arrived':
        return Colors.cyan;
      case 'delivered':
        return Colors.green;
      default:
        return Colors.grey;
    }
  }
}

Widget darkModeTileBuilder(
  BuildContext context,
  Widget tile,
  TileImage tileImage,
) {
  return ColorFiltered(
    colorFilter: const ColorFilter.matrix([
      -0.2126,
      -0.7152,
      -0.0722,
      0,
      255,
      -0.2126,
      -0.7152,
      -0.0722,
      0,
      255,
      -0.2126,
      -0.7152,
      -0.0722,
      0,
      255,
      0,
      0,
      0,
      1,
      0,
    ]),
    child: tile,
  );
}
