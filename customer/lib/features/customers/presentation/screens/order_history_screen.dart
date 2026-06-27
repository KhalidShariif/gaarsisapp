import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_typography.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/routes/app_routes.dart';
import '../../../../core/utils/api_service.dart';
import '../models/order_model.dart';
import '../widgets/order_tile.dart';
import '../../../../core/theme/theme_provider.dart';

class OrderHistoryScreen extends StatefulWidget {
  const OrderHistoryScreen({super.key});

  @override
  State<OrderHistoryScreen> createState() => _OrderHistoryScreenState();
}

class _OrderHistoryScreenState extends State<OrderHistoryScreen> {
  final List<String> _filters = [
    'All Orders',
    'Delivered',
    'Processing',
    'Cancelled',
  ];
  int _selectedFilterIndex = 0;
  List<dynamic> _orders = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchOrders();
  }

  Future<void> _fetchOrders() async {
    try {
      final response = await ApiService.get('/customer/orders');
      if (!mounted) return;
      if (response.statusCode == 200) {
        setState(() => _orders = jsonDecode(response.body));
      }
    } catch (e) {
      debugPrint('Error fetching orders: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  OrderStatus _mapStatus(String? status) {
    switch (status?.toLowerCase()) {
      case 'pending':
        return OrderStatus.pending;
      case 'accepted':
        return OrderStatus.accepted;
      case 'driver assigned':
        return OrderStatus.driverAssigned;
      case 'on the way':
        return OrderStatus.onTheWay;
      case 'delivered':
        return OrderStatus.delivered;
      case 'cancelled':
        return OrderStatus.cancelled;
      default:
        return OrderStatus.pending;
    }
  }

  List<dynamic> get _filteredOrders {
    if (_selectedFilterIndex == 0) return _orders;
    final filterName = _filters[_selectedFilterIndex].toLowerCase();
    return _orders.where((o) {
      final status = (o['status'] ?? '').toString().toLowerCase();
      if (filterName == 'processing') {
        return status == 'pending' ||
            status == 'accepted' ||
            status == 'driver assigned' ||
            status == 'on the way';
      }
      return status == filterName;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<ThemeProvider>(context); // subscribe to theme changes
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final isDark = cs.brightness == Brightness.dark;
    final bgColor = theme.scaffoldBackgroundColor;
    final textPrimary = cs.onSurface;
    final textSecondary = isDark ? AppColors.textSecondaryDark : AppColors.textSecondary;
    final borderColor = isDark ? AppColors.borderDark : AppColors.border;
    final surfaceColor = cs.surface;

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: bgColor,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Order History',
          style: TextStyle(
            color: textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 20,
            letterSpacing: -0.5,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.more_vert, color: textPrimary),
            onPressed: () {},
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Divider(height: 1, color: borderColor.withAlpha(102)),
        ),
      ),
      body: CustomScrollView(
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.all(AppSpacing.m),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                _buildSearchField(
                  isDark: isDark,
                  textPrimary: textPrimary,
                  textSecondary: textSecondary,
                  surfaceColor: surfaceColor,
                  borderColor: borderColor,
                ),
                const SizedBox(height: AppSpacing.m),
                _buildFilters(
                  isDark: isDark,
                  textSecondary: textSecondary,
                  surfaceColor: surfaceColor,
                ),
                const SizedBox(height: AppSpacing.l),
                Text(
                  'RECENT ACTIVITY',
                  style: AppTypography.label.copyWith(
                    color: textSecondary.withAlpha(128),
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: AppSpacing.m),
                if (_isLoading)
                  Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  )
                else if (_filteredOrders.isEmpty)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 50.0),
                      child: Text(
                        'No orders found',
                        style: TextStyle(color: textSecondary),
                      ),
                    ),
                  )
                else
                  ..._filteredOrders.map((order) => _buildOrderHistoryItem(
                        context,
                        order,
                        borderColor: borderColor,
                        textSecondary: textSecondary,
                      )),
                const SizedBox(height: AppSpacing.m),
                _buildLoadMoreButton(
                  textSecondary: textSecondary,
                  borderColor: borderColor,
                ),
                const SizedBox(height: 80),
              ]),
            ),
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomNav(
        context,
        bgColor: bgColor,
        borderColor: borderColor,
        textSecondary: textSecondary,
      ),
    );
  }

  Widget _buildSearchField({
    required bool isDark,
    required Color textPrimary,
    required Color textSecondary,
    required Color surfaceColor,
    required Color borderColor,
  }) {
    return TextField(
      style: TextStyle(color: textPrimary),
      decoration: InputDecoration(
        filled: true,
        fillColor: surfaceColor.withAlpha(128),
        hintText: 'Search orders, items, or IDs...',
        hintStyle: TextStyle(color: textSecondary.withAlpha(153), fontSize: 14),
        prefixIcon: Icon(Icons.search, color: textSecondary.withAlpha(153)),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusXL),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(vertical: 12),
      ),
    );
  }

  Widget _buildFilters({
    required bool isDark,
    required Color textSecondary,
    required Color surfaceColor,
  }) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: [
          ...List.generate(_filters.length, (index) {
            final isSelected = _selectedFilterIndex == index;
            return GestureDetector(
              onTap: () => setState(() => _selectedFilterIndex = index),
              child: Container(
                margin: const EdgeInsets.only(right: 8),
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.primary : surfaceColor,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
                ),
                child: Text(
                  _filters[index],
                  style: TextStyle(
                    color: isSelected ? Colors.white : textSecondary,
                    fontSize: 14,
                    fontWeight:
                        isSelected ? FontWeight.bold : FontWeight.w500,
                  ),
                ),
              ),
            );
          }),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: surfaceColor,
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.tune, size: 18, color: textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadMoreButton({
    required Color textSecondary,
    required Color borderColor,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppSpacing.radiusXL),
        border: Border.all(color: borderColor, width: 2),
      ),
      child: Center(
        child: Text(
          'View Older Orders',
          style: TextStyle(
            color: textSecondary.withAlpha(204),
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  Widget _buildOrderHistoryItem(
    BuildContext context,
    dynamic order, {
    required Color borderColor,
    required Color textSecondary,
  }) {
    final status = _mapStatus(order['status']);
    final hasReview = _asBool(order['has_review']);
    final canReview = status == OrderStatus.delivered;

    return Column(
      children: [
        OrderTile(
          order: OrderModel(
            id: order['id'].toString(),
            title: 'Order from ${order['vendor_name'] ?? 'Vendor'}',
            station: order['vendor_name'] ?? 'Station',
            amount: double.tryParse(order['total_amount'].toString()) ?? 0.0,
            date: order['created_at'],
            status: status,
            icon: Icons.local_gas_station,
          ),
          onTap: () => Navigator.pushNamed(
            context,
            AppRoutes.status,
            arguments: order,
          ),
        ),
        if (canReview)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.m),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: hasReview
                    ? null
                    : () async {
                        await Navigator.pushNamed(
                          context,
                          AppRoutes.ratingReview,
                          arguments: order,
                        );
                        if (mounted) _fetchOrders();
                      },
                icon: Icon(hasReview ? Icons.check_circle : Icons.star_border),
                label: Text(hasReview ? 'Reviewed' : 'Review Order'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: hasReview ? textSecondary : AppColors.primary,
                  side: BorderSide(color: hasReview ? borderColor : AppColors.primary),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppSpacing.radiusL),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ),
      ],
    );
  }

  bool _asBool(dynamic value) {
    if (value is bool) return value;
    if (value is num) return value != 0;
    final text = value?.toString().toLowerCase().trim() ?? '';
    return text == 'true' || text == '1' || text == 'yes';
  }

  Widget _buildBottomNav(
    BuildContext context, {
    required Color bgColor,
    required Color borderColor,
    required Color textSecondary,
  }) {
    return Container(
      padding: const EdgeInsets.only(top: 12, bottom: 24, left: 16, right: 16),
      decoration: BoxDecoration(
        color: bgColor,
        border: Border(top: BorderSide(color: borderColor.withAlpha(77))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildNavItem(context, Icons.home, 'HOME', false,
              textSecondary: textSecondary, route: AppRoutes.home),
          _buildNavItem(context, Icons.history, 'ORDERS', true,
              textSecondary: textSecondary, route: AppRoutes.history),
          _buildNavItem(context, Icons.local_shipping, 'STATIONS', false,
              textSecondary: textSecondary, route: AppRoutes.selectStation),
          _buildNavItem(context, Icons.person, 'PROFILE', false,
              textSecondary: textSecondary, route: AppRoutes.profile),
        ],
      ),
    );
  }

  Widget _buildNavItem(
    BuildContext context,
    IconData icon,
    String label,
    bool isSelected, {
    required Color textSecondary,
    String? route,
  }) {
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
            color: isSelected ? AppColors.primary : textSecondary,
            size: 24,
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: AppTypography.label.copyWith(
              fontSize: 10,
              color: isSelected ? AppColors.primary : textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
