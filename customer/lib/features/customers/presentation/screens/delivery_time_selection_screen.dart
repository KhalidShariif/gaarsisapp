import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:deliveryapp/core/theme/theme_provider.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_spacing.dart';
import '../models/time_slot_model.dart';
import '../models/cart_item_model.dart';
import '../../../../core/routes/app_routes.dart';

const Color _kOrange = Color(0xFFF97316);

class DeliveryTimeSelectionScreen extends StatefulWidget {
  const DeliveryTimeSelectionScreen({super.key});

  @override
  State<DeliveryTimeSelectionScreen> createState() =>
      _DeliveryTimeSelectionScreenState();
}

class _DeliveryTimeSelectionScreenState
    extends State<DeliveryTimeSelectionScreen> {
  int _selectedDateIndex = 0;
  int _selectedSlotIndex = 0;

  // Hardcoded, never null
  final List<String> _dateLabels = const <String>['Today', 'Tomorrow'];

  List<TimeSlotModel> get _availableSlots => _selectedDateIndex == 1
      ? TimeSlotModel.slots
            .where((slot) => !slot.isExpress)
            .toList(growable: false)
      : TimeSlotModel.slots;

  // Safe, typed fields extracted from route args
  Map<String, dynamic> _args = <String, dynamic>{};
  Map<String, dynamic> _product = <String, dynamic>{};
  Map<String, dynamic> _vendor = <String, dynamic>{};
  String _productName = '';
  String _vendorName = '';
  String _quantity = '0';
  String _subtotal = '0.00';

  // Cart-aware
  bool _isCartMode = false; // true when coming from cart/price_summary
  String _itemsSummary = ''; // e.g. "50L • Petrol" or "2x items"

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    try {
      // Step 1: Get raw arguments
      final rawArgs = ModalRoute.of(context)?.settings.arguments;

      // Step 2: Safely coerce into Map<String, dynamic>
      if (rawArgs != null && rawArgs is Map) {
        _args = Map<String, dynamic>.from(rawArgs);
      } else {
        _args = <String, dynamic>{};
      }

      // Step 3: Check if this is a cart-mode checkout (from PriceSummary)
      final rawCartItems = _args['cart_items'];
      _isCartMode = rawCartItems is List && rawCartItems.isNotEmpty;

      if (_isCartMode) {
        // ── Cart Mode: Coming from Shopping Cart / Price Summary ──
        final cartItems = <CartItemModel>[];
        for (final item in rawCartItems as List) {
          if (item is CartItemModel) {
            cartItems.add(item);
          }
        }

        // Build items summary label
        if (cartItems.length == 1) {
          final item = cartItems.first;
          _productName = item.title;
          _vendorName = item.vendorName ?? '';
          final qty = item.quantity;
          _itemsSummary = '${qty}x • ${item.title}';
        } else {
          _productName = '${cartItems.length} Items';
          _vendorName = cartItems.firstOrNull?.vendorName ?? '';
          final totalQty = cartItems.fold<int>(0, (sum, i) => sum + i.quantity);
          _itemsSummary = '${cartItems.length} items (${totalQty}x total)';
        }
        _quantity = cartItems
            .fold<int>(0, (sum, i) => sum + i.quantity)
            .toString();

        // Subtotal from args
        final rawSubtotal = _args['subtotal'];
        final parsedSubtotal =
            double.tryParse(rawSubtotal?.toString() ?? '0') ?? 0.0;
        _subtotal = parsedSubtotal.toStringAsFixed(2);
      } else {
        // ── Single Product Mode: Coming from Fuel/Gas flows ──
        final rawProduct = _args['product'];
        if (rawProduct != null && rawProduct is Map) {
          _product = Map<String, dynamic>.from(rawProduct);
        } else {
          _product = <String, dynamic>{};
        }

        final rawVendor = _args['vendor'];
        if (rawVendor != null && rawVendor is Map) {
          _vendor = Map<String, dynamic>.from(rawVendor);
        } else {
          _vendor = <String, dynamic>{};
        }

        _productName =
            ((_product['product_name'] ?? _product['name']) ?? 'Fuel')
                .toString();
        _vendorName = ((_vendor['vendor_name'] ?? _vendor['name']) ?? '')
            .toString();
        _quantity = (_args['quantity'] ?? 0).toString();
        final rawTotal = _args['effective_total'] ?? _args['total'];
        final parsedTotal = double.tryParse(rawTotal?.toString() ?? '0') ?? 0.0;
        _subtotal = parsedTotal.toStringAsFixed(2);

        // Build items summary for single product
        final qty = double.tryParse(_quantity) ?? 0;
        final qtyStr = qty == qty.truncateToDouble()
            ? qty.toInt().toString()
            : qty.toString();
        final unit = (_args['unit'] ?? _product['unit'] ?? '')
            .toString()
            .toLowerCase();
        final isKg =
            unit == 'kg' ||
            _productName.toLowerCase().contains('gas') ||
            _productName.toLowerCase().contains('cylinder') ||
            (_product['category'] ?? '').toString().toLowerCase().contains(
              'gas',
            );
        final unitLabel = isKg ? 'KG' : 'L';
        _itemsSummary = '$qtyStr $unitLabel • $_productName';
      }
    } catch (e) {
      debugPrint(
        'DEBUG: [DeliveryTimeSelectionScreen] Error parsing arguments: $e',
      );
      _args = <String, dynamic>{};
      _product = <String, dynamic>{};
      _vendor = <String, dynamic>{};
      _productName = 'Fuel';
      _vendorName = '';
      _quantity = '0';
      _subtotal = '0.00';
      _isCartMode = false;
      _itemsSummary = '0L • Fuel';
    }

    // Defensive Logging
    debugPrint('DEBUG: [DeliveryTimeSelectionScreen] _args: $_args');
    debugPrint(
      'DEBUG: [DeliveryTimeSelectionScreen] _productName: $_productName',
    );
    debugPrint(
      'DEBUG: [DeliveryTimeSelectionScreen] _vendorName: $_vendorName',
    );
    debugPrint('DEBUG: [DeliveryTimeSelectionScreen] _quantity: $_quantity');
    debugPrint('DEBUG: [DeliveryTimeSelectionScreen] _subtotal: $_subtotal');
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<ThemeProvider>(context); // listen for theme changes
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            _buildProgressBar(),
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: AppSpacing.s),
                    _buildSectionHeader(Icons.calendar_today, 'Select Date'),
                    _buildDateSelector(),
                    const SizedBox(height: AppSpacing.s),
                    _buildSectionHeader(Icons.schedule, 'Select Time Slot'),
                    _buildSlotList(),
                    _buildOrderSummaryCard(),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
            _buildFooter(context),
          ],
        ),
      ),
    );
  }

  // ── Header ──────────────────────────────────────────────────────────────

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.m,
        AppSpacing.s,
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withOpacity(0.1)),
              ),
              child: const Icon(
                Icons.arrow_back,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
          const Expanded(
            child: Text(
              'Delivery Schedule',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
                letterSpacing: -0.3,
              ),
            ),
          ),
          const SizedBox(width: 44),
        ],
      ),
    );
  }

  // ── Progress bar ─────────────────────────────────────────────────────────

  Widget _buildProgressBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(99),
        child: Container(
          height: 4,
          color: AppColors.border,
          child: const FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: 0.60,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [_kOrange, Color(0xFFFB923C)]),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Section header ───────────────────────────────────────────────────────

  Widget _buildSectionHeader(IconData icon, String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.l,
        AppSpacing.xl,
        AppSpacing.l,
        AppSpacing.m,
      ),
      child: Row(
        children: [
          Icon(icon, color: _kOrange, size: 18),
          const SizedBox(width: 8),
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 17,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  // ── Date toggle ──────────────────────────────────────────────────────────

  Widget _buildDateSelector() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.l),
      child: Container(
        height: 52,
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withOpacity(0.08)),
        ),
        child: Row(
          children: List.generate(_dateLabels.length, (i) => _buildDateTab(i)),
        ),
      ),
    );
  }

  Widget _buildDateTab(int index) {
    final bool isSelected = _selectedDateIndex == index;
    final String label = (index >= 0 && index < _dateLabels.length)
        ? _dateLabels[index]
        : '';
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() {
          _selectedDateIndex = index;
          _selectedSlotIndex = 0;
        }),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeInOut,
          decoration: BoxDecoration(
            color: isSelected ? _kOrange : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: _kOrange.withOpacity(0.35),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ]
                : null,
          ),
          child: Center(
            child: Text(
              (label ?? '').toString(),
              style: TextStyle(
                color: isSelected ? Colors.white : Colors.white54,
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Slot cards ───────────────────────────────────────────────────────────

  Widget _buildSlotList() {
    final slots = _availableSlots;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
      child: Column(
        children: List.generate(
          slots.length,
          (i) => _buildSlotCard(i, slots[i]),
        ),
      ),
    );
  }

  Widget _buildSlotCard(int index, TimeSlotModel slot) {
    final bool isSelected = _selectedSlotIndex == index;
    final Color accent = slot.isExpress ? _kOrange : AppColors.primary;

    return GestureDetector(
      onTap: () => setState(() => _selectedSlotIndex = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeInOut,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(AppSpacing.l),
        decoration: BoxDecoration(
          color: isSelected
              ? accent.withOpacity(0.08)
              : Colors.white.withOpacity(0.04),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? accent : Colors.white.withOpacity(0.1),
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: accent.withOpacity(0.18),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: isSelected
                    ? accent.withOpacity(0.18)
                    : Colors.white.withOpacity(0.07),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                slot.icon,
                color: isSelected ? accent : Colors.white60,
                size: 22,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        (slot.label ?? '').toString(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (slot.tag != null) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: _kOrange,
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: Text(
                            (slot.tag ?? '').toString(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    (slot.timeRange ?? '').toString(),
                    style: const TextStyle(
                      color: Colors.white54,
                      fontSize: 12.5,
                    ),
                  ),
                ],
              ),
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? accent : Colors.white30,
                  width: 2,
                ),
              ),
              child: isSelected
                  ? Center(
                      child: Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: accent,
                        ),
                      ),
                    )
                  : null,
            ),
          ],
        ),
      ),
    );
  }

  // ── Order Summary card ───────────────────────────────────────────────────

  Widget _buildOrderSummaryCard() {
    final slots = _availableSlots;
    final String dateLabel =
        (_selectedDateIndex >= 0 && _selectedDateIndex < _dateLabels.length)
        ? _dateLabels[_selectedDateIndex]
        : 'Today';

    final TimeSlotModel? slot =
        (_selectedSlotIndex >= 0 && _selectedSlotIndex < slots.length)
        ? slots[_selectedSlotIndex]
        : null;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.l,
        AppSpacing.s,
        AppSpacing.l,
        0,
      ),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.m),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.08)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: _kOrange.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: const Icon(
                    Icons.receipt_long,
                    color: _kOrange,
                    size: 16,
                  ),
                ),
                const SizedBox(width: 10),
                const Text(
                  'Order Summary',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            const Divider(color: Colors.white12, height: 1),
            const SizedBox(height: 12),
            _summaryRow(
              icon: Icons.calendar_today,
              label: 'Delivery Date',
              value: (dateLabel ?? '').toString(),
            ),
            const SizedBox(height: 8),
            _summaryRow(
              icon: Icons.schedule,
              label: 'Time Slot',
              value:
                  '${(slot?.label ?? '').toString()}  •  ${(slot?.timeRange ?? '').toString()}',
              valueColor: _kOrange,
            ),
            const SizedBox(height: 8),
            _summaryRow(
              icon: _isCartMode
                  ? Icons.shopping_bag_outlined
                  : Icons.local_gas_station,
              label: 'Items',
              value: _itemsSummary,
            ),
            const SizedBox(height: 8),
            _summaryRow(
              icon: Icons.attach_money,
              label: 'Subtotal',
              value: '\$${(_subtotal ?? '0.00').toString()}',
              valueColor: Colors.white,
            ),
          ],
        ),
      ),
    );
  }

  Widget _summaryRow({
    required IconData icon,
    required String label,
    required String value,
    Color valueColor = Colors.white70,
  }) {
    return Row(
      children: [
        Icon(icon, color: Colors.white38, size: 14),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Colors.white54, fontSize: 12),
          ),
        ),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.right,
            style: TextStyle(
              color: valueColor,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }

  // ── Footer CTA ──────────────────────────────────────────────────────────

  Widget _buildFooter(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.l,
        AppSpacing.m,
        AppSpacing.l,
        AppSpacing.xl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: double.infinity,
            height: 54,
            child: ElevatedButton(
              onPressed: () {
                // Attach selected scheduling data to args before navigating
                final scheduledArgs = Map<String, dynamic>.from(_args);
                final slots = _availableSlots;
                final dateLabel =
                    (_selectedDateIndex >= 0 &&
                        _selectedDateIndex < _dateLabels.length)
                    ? _dateLabels[_selectedDateIndex]
                    : 'Today';
                final slot =
                    (_selectedSlotIndex >= 0 &&
                        _selectedSlotIndex < slots.length)
                    ? slots[_selectedSlotIndex]
                    : slots.first;
                scheduledArgs['delivery_date'] = dateLabel;
                scheduledArgs['delivery_slot'] = slot.label;
                scheduledArgs['delivery_time_range'] = slot.timeRange;
                Navigator.pushNamed(
                  context,
                  AppRoutes.deliveryLocationChoice,
                  arguments: scheduledArgs,
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: _kOrange,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                elevation: 0,
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Continue to Payment',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(width: 8),
                  Icon(Icons.arrow_forward, color: Colors.white, size: 18),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'Delivery fees may vary based on selected time slot',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white38, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
