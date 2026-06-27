import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/api_service.dart';
import '../../../../core/routes/app_routes.dart';
import '../../../../core/theme/theme_provider.dart';

class OrderStatusScreen extends StatefulWidget {
  const OrderStatusScreen({super.key});

  @override
  State<OrderStatusScreen> createState() => _OrderStatusScreenState();
}

class _OrderStatusScreenState extends State<OrderStatusScreen> {
  dynamic _trackingData;
  bool _isLoading = true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final order = ModalRoute.of(context)?.settings.arguments;
    if (order != null && _trackingData == null) {
      final orderId = (order as Map)['id'];
      _fetchTracking(orderId);
    }
  }

  Future<void> _fetchTracking(dynamic orderId) async {
    try {
      final response = await ApiService.get(
        '/customer/orders/$orderId/tracking',
      );
      if (response.statusCode == 200) {
        if (mounted) {
          setState(() {
            _trackingData = jsonDecode(response.body);
          });
        }
      }
    } catch (e) {
      debugPrint('Error fetching tracking: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<ThemeProvider>(context); // listen for theme changes
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    final bgColor = theme.scaffoldBackgroundColor;
    final textPrimary = cs.onSurface;
    final textSecondary = isDark
        ? AppColors.textSecondaryDark
        : AppColors.textSecondary;

    if (_isLoading) {
      return Scaffold(
        backgroundColor: bgColor,
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_trackingData == null) {
      return Scaffold(
        backgroundColor: bgColor,
        appBar: AppBar(backgroundColor: bgColor, elevation: 0),
        body: Center(
          child: Text('Order not found', style: TextStyle(color: textPrimary)),
        ),
      );
    }

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: bgColor,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: textPrimary),
        ),
        title: Text(
          'Track Delivery',
          style: TextStyle(
            color: textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _fetchTracking(_trackingData['order_id']),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.m),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.m),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: AppColors.primary.withAlpha(20),
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppColors.primary.withAlpha(51),
                              ),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: _buildLogoWidget(
                              _trackingData['vendor_logo'],
                              size: 48,
                              fallbackIcon: Icons.storefront,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'CURRENT ORDER',
                                style: AppTypography.label.copyWith(
                                  color: textSecondary,
                                  fontSize: 10,
                                  letterSpacing: 1,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '#ORD-${_trackingData['order_id']}',
                                style: TextStyle(
                                  color: textPrimary,
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              if ((_trackingData['vendor_name'] ?? '')
                                  .toString()
                                  .isNotEmpty)
                                Text(
                                  _trackingData['vendor_name'].toString(),
                                  style: const TextStyle(
                                    color: AppColors.primary,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withAlpha(51),
                          borderRadius: BorderRadius.circular(
                            AppSpacing.radiusFull,
                          ),
                        ),
                        child: Text(
                          _formatStatus(
                            _trackingData['status']?.toString() ?? 'pending',
                          ).toUpperCase(),
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                _buildOTPCard(_trackingData['delivery_otp']),
                _buildMapSection(context),
                _buildTimeline(_trackingData),
                _buildReviewAction(context, _trackingData),
                const SizedBox(height: 48),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: _buildBottomNav(context),
    );
  }

  Widget _buildOTPCard(dynamic otp) {
    final code = otp?.toString() ?? '';
    if (code.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.m,
        vertical: AppSpacing.s,
      ),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [AppColors.primary, AppColors.primary.withAlpha(178)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(AppSpacing.radiusXL),
        ),
        child: Column(
          children: [
            Row(
              children: [
                const Icon(
                  Icons.lock_person_outlined,
                  color: Colors.white,
                  size: 32,
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Delivery Verification Code',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        code,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Row(
              children: [
                Icon(Icons.info_outline, color: Colors.white70, size: 16),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Give this code to the driver when your order arrives',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMapSection(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final borderColor = isDark ? AppColors.borderDark : AppColors.border;

    return GestureDetector(
      onTap: () => Navigator.pushNamed(
        context,
        AppRoutes.liveTracking,
        arguments: _trackingData,
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.m),
        child: Container(
          height: 192,
          width: double.infinity,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppSpacing.radiusXL),
            border: Border.all(color: borderColor),
            image: const DecorationImage(
              image: AssetImage('assets/images/map_placeholder.png'),
              fit: BoxFit.cover,
              colorFilter: ColorFilter.mode(Colors.black38, BlendMode.darken),
            ),
          ),
          child: Stack(
            children: [
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.local_shipping,
                      color: AppColors.primary,
                      size: 32,
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'VIEW LIVE MAP',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTimeline(dynamic tracking) {
    final status = _canonicalStatus(
      tracking['status']?.toString() ?? 'pending',
    );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Column(
        children: [
          _buildTimelineItem(
            'Order Placed',
            'Your order has been received.',
            _formatTrackingTime(tracking['created_at']),
            Icons.check,
            true,
            true,
          ),
          _buildTimelineItem(
            'Driver Assigned',
            tracking['driver_name'] != null
                ? '${tracking['driver_name']} is assigned.'
                : 'Waiting for driver assignment.',
            '',
            Icons.person,
            status != 'pending' && status != 'accepted',
            true,
          ),
          _buildTimelineItem(
            'En Route',
            'The driver is on the way to your location.',
            '',
            Icons.local_shipping,
            [
              'picked_up',
              'on_the_way',
              'arrived',
              'delivered',
            ].contains(status),
            true,
            isActive: status == 'on_the_way',
          ),
          _buildTimelineItem(
            'Delivered',
            'Delivery completed.',
            _formatTrackingTime(tracking['delivered_at']),
            Icons.flag,
            status == 'delivered',
            false,
            isLast: true,
          ),
        ],
      ),
    );
  }

  Widget _buildReviewAction(BuildContext context, dynamic tracking) {
    final status = _canonicalStatus(tracking['status']?.toString() ?? '');
    if (status != 'delivered') return const SizedBox.shrink();

    final hasReview = _asBool(tracking['has_review']);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: hasReview
              ? null
              : () async {
                  await Navigator.pushNamed(
                    context,
                    AppRoutes.ratingReview,
                    arguments: tracking,
                  );
                  if (mounted) {
                    _fetchTracking(tracking['order_id']);
                  }
                },
          icon: Icon(hasReview ? Icons.check_circle : Icons.star_border),
          label: Text(hasReview ? 'Review Submitted' : 'Review This Delivery'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            disabledBackgroundColor: AppColors.success.withAlpha(40),
            disabledForegroundColor: AppColors.success,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusL),
            ),
          ),
        ),
      ),
    );
  }

  bool _asBool(dynamic value) {
    if (value is bool) return value;
    if (value is num) return value != 0;
    final text = value?.toString().toLowerCase().trim() ?? '';
    return text == 'true' || text == '1' || text == 'yes';
  }

  String _canonicalStatus(String status) {
    switch (status.toLowerCase().trim()) {
      case 'driver assigned':
        return 'assigned';
      case 'on the way':
        return 'on_the_way';
      default:
        return status.toLowerCase().trim().replaceAll(' ', '_');
    }
  }

  String _formatStatus(String status) {
    return _canonicalStatus(status).replaceAll('_', ' ');
  }

  String _formatTrackingTime(dynamic value) {
    final raw = value?.toString() ?? '';
    if (raw.isEmpty) return '';

    final parsed = DateTime.tryParse(raw);
    if (parsed != null) {
      final hour = parsed.hour.toString().padLeft(2, '0');
      final minute = parsed.minute.toString().padLeft(2, '0');
      return '$hour:$minute';
    }

    return raw.length >= 16 ? raw.substring(11, 16) : raw;
  }

  Widget _buildTimelineItem(
    String title,
    String subtitle,
    String time,
    IconData icon,
    bool isCompleted,
    bool hasLineBelow, {
    bool isLast = false,
    bool isActive = false,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final textPrimary = theme.colorScheme.onSurface;
    final textSecondary = isDark
        ? AppColors.textSecondaryDark
        : AppColors.textSecondary;
    final borderColor = isDark ? AppColors.borderDark : AppColors.border;
    final dotBg = isCompleted
        ? AppColors.primary
        : (isDark
              ? AppColors.surfaceDark.withAlpha(128)
              : Colors.grey.shade200);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: dotBg,
                  shape: BoxShape.circle,
                  border: isCompleted ? null : Border.all(color: borderColor),
                ),
                child: Icon(
                  icon,
                  color: isCompleted ? Colors.white : textSecondary,
                  size: 18,
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    color: isCompleted ? AppColors.primary : borderColor,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 32.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: isCompleted ? textPrimary : textSecondary,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(color: textSecondary, fontSize: 13),
                  ),
                  if (time.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4.0),
                      child: Text(
                        time,
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomNav(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final bgColor = theme.scaffoldBackgroundColor;
    final borderColor = isDark ? AppColors.borderDark : AppColors.border;

    return Container(
      padding: const EdgeInsets.only(top: 12, bottom: 24, left: 16, right: 16),
      decoration: BoxDecoration(
        color: bgColor,
        border: Border(top: BorderSide(color: borderColor.withAlpha(76))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildNavItem(
            context,
            Icons.home_outlined,
            'HOME',
            false,
            route: AppRoutes.home,
          ),
          _buildNavItem(
            context,
            Icons.assignment,
            'ORDERS',
            true,
            route: AppRoutes.history,
          ),
          _buildNavItem(
            context,
            Icons.person_outline,
            'PROFILE',
            false,
            route: AppRoutes.profile,
          ),
          _buildNavItem(context, Icons.help_outline, 'SUPPORT', false),
        ],
      ),
    );
  }

  Widget _buildNavItem(
    BuildContext context,
    IconData icon,
    String label,
    bool isSelected, {
    String? route,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final unselectedColor = isDark
        ? AppColors.textSecondaryDark
        : AppColors.textSecondary;

    return GestureDetector(
      onTap: () {
        if (route != null && !isSelected) {
          Navigator.pushNamed(context, route);
        }
      },
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: isSelected ? AppColors.primary : unselectedColor,
            size: 24,
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: AppTypography.label.copyWith(
              fontSize: 10,
              color: isSelected ? AppColors.primary : unselectedColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLogoWidget(
    dynamic logo, {
    double size = 48,
    IconData fallbackIcon = Icons.storefront,
  }) {
    if (logo == null || logo.toString().isEmpty) {
      return Icon(fallbackIcon, color: AppColors.primary, size: size * 0.5);
    }
    final logoStr = logo.toString();
    final url = logoStr.startsWith('http')
        ? logoStr
        : '${ApiService.baseUrl.replaceAll('/api', '')}$logoStr';
    return Image.network(
      url,
      width: size,
      height: size,
      fit: BoxFit.cover,
      errorBuilder: (context, error, stackTrace) {
        return Icon(fallbackIcon, color: AppColors.primary, size: size * 0.5);
      },
    );
  }
}
