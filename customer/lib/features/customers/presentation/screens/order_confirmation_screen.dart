import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:deliveryapp/core/theme/theme_provider.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../shared/widgets/custom_button.dart';
import '../../../../core/routes/app_routes.dart';
import '../../../../core/utils/api_service.dart';
import '../../../../core/utils/cart_service.dart';
import '../models/cart_item_model.dart';

class OrderConfirmationScreen extends StatefulWidget {
  const OrderConfirmationScreen({super.key});

  @override
  State<OrderConfirmationScreen> createState() =>
      _OrderConfirmationScreenState();
}

class _OrderConfirmationScreenState extends State<OrderConfirmationScreen> {
  bool _isProcessing = false;
  String _processingStep = 'Preparing order...';
  bool _isOrderCreated = false;
  dynamic _createdOrderId;

  String _newCheckoutRequestId() =>
      'checkout-${DateTime.now().microsecondsSinceEpoch}';

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.error_outline, color: Colors.white),
            const SizedBox(width: 8),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: Colors.redAccent,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusM),
        ),
      ),
    );
  }

  String _readablePaymentMessage(String message) {
    var cleaned = message.trim();
    final paymentFailedPrefix = RegExp(
      r'^Payment Failed\s*\(',
      caseSensitive: false,
    );

    cleaned = cleaned.replaceFirst(paymentFailedPrefix, '');
    if (cleaned.endsWith(')')) {
      cleaned = cleaned.substring(0, cleaned.length - 1).trim();
    }

    return cleaned.isEmpty
        ? 'Payment failed. Please check your wallet balance and try again.'
        : cleaned;
  }

  Future<void> _showPaymentErrorDialog(String message) async {
    if (!mounted) return;

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        final theme = Theme.of(dialogContext);
        final cs = theme.colorScheme;
        final isDark = theme.brightness == Brightness.dark;

        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusL),
          ),
          titlePadding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
          contentPadding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
          actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          title: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.redAccent.withAlpha(30),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.error_outline, color: Colors.redAccent),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Payment Failed',
                  style: TextStyle(
                    color: cs.onSurface,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          content: ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 260),
            child: SingleChildScrollView(
              child: Text(
                _readablePaymentMessage(message),
                style: TextStyle(
                  color: isDark
                      ? AppColors.textSecondaryDark
                      : AppColors.textSecondary,
                  fontSize: 15,
                  height: 1.45,
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('OK'),
            ),
          ],
        );
      },
    );
  }

  int? _parseInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString());
  }

  int? _resolveVendorId(Map<String, dynamic> args) {
    final directVendorId = _parseInt(args['vendor_id']);
    if (directVendorId != null && directVendorId > 0) return directVendorId;

    final vendor = args['vendor'];
    if (vendor is Map) {
      final vendorId = _parseInt(vendor['id'] ?? vendor['vendor_id']);
      if (vendorId != null && vendorId > 0) return vendorId;
    }

    final items = args['items'];
    if (items is List) {
      for (final item in items) {
        if (item is Map) {
          final vendorId = _parseInt(item['vendor_id']);
          if (vendorId != null && vendorId > 0) return vendorId;
        }
      }
    }

    final cartItems = args['cart_items'];
    if (cartItems is List) {
      for (final item in cartItems) {
        if (item is CartItemModel && item.vendorId != null) {
          return item.vendorId;
        }
      }
    }

    return 1;
  }

  Future<void> _confirmAndPlaceOrder(Map<String, dynamic> args) async {
    setState(() {
      _isProcessing = true;
      _processingStep = 'Preparing order...';
    });

    final paymentMethod =
        args['payment_method']?.toString().toLowerCase() ?? '';
    final isOnlinePayment =
        paymentMethod != 'cod' &&
        paymentMethod != 'cash_on_delivery' &&
        paymentMethod != 'cash on delivery';
    setState(
      () => _processingStep = isOnlinePayment
          ? 'Initiating payment request...'
          : 'Submitting order to vendor...',
    );

    try {
      final deliveryFee =
          double.tryParse(args['delivery_fee']?.toString() ?? '0') ?? 0.0;
      final effectiveDeliveryFee =
          double.tryParse(args['effective_delivery_fee']?.toString() ?? '') ??
          deliveryFee;
      final vendorId = _resolveVendorId(args);
      if (vendorId == null || vendorId <= 0) {
        setState(() => _isProcessing = false);
        _showPaymentErrorDialog(
          'Vendor not found. Please go back and select the station again.',
        );
        return;
      }

      final Map<String, dynamic> payload = {
        'vendor_id': vendorId,
        'delivery_address': args['delivery_address'],
        'delivery_phone': args['delivery_phone'],
        'delivery_addresses': args['delivery_addresses'],
        'delivery_latitude': args['delivery_latitude'],
        'delivery_longitude': args['delivery_longitude'],
        'payment_method': args['payment_method'],
        'payment_phone': args['payment_phone'],
        'external_merchant_payment': args['external_merchant_payment'] == true,
        'checkout_request_id': _newCheckoutRequestId(),
        'items': args['items'],
        'delivery_fee': deliveryFee,
        'effective_delivery_fee': effectiveDeliveryFee,
        'offer_id': args['offer_id'],
        // Scheduling (stored as notes if the DB supports it)
        if (args['delivery_date'] != null)
          'delivery_date': args['delivery_date'],
        if (args['delivery_slot'] != null)
          'delivery_slot': args['delivery_slot'],
      };

      if (isOnlinePayment) {
        final response = await ApiService.post('/payment/hurmood/create', payload);

        if (response.statusCode == 200 || response.statusCode == 201) {
          final resBody = jsonDecode(response.body);
          final transactionId = resBody['transactionId'];

          setState(() {
            _processingStep = 'Waiting for payment approval...\nPlease check your phone for EVC Plus PIN prompt.';
          });

          int pollCount = 0;
          const maxPolls = 24; // ~1 minute max (2.5 seconds * 24)
          Timer.periodic(const Duration(milliseconds: 2500), (timer) async {
            pollCount++;
            if (!mounted) {
              timer.cancel();
              return;
            }

            if (pollCount > maxPolls) {
              timer.cancel();
              setState(() => _isProcessing = false);
              _showPaymentErrorDialog('Payment timeout. If you confirmed the PIN, please check your orders history.');
              return;
            }

            try {
              final statusRes = await ApiService.get('/payment/status/$transactionId');
              if (!mounted) {
                timer.cancel();
                return;
              }

              if (statusRes.statusCode == 200) {
                final statusBody = jsonDecode(statusRes.body);
                final status = statusBody['status']?.toString().toUpperCase();
                final orderId = statusBody['orderId'];

                if (status == 'SUCCESS') {
                  timer.cancel();
                  await CartService.clearCart();
                  setState(() {
                    _isProcessing = false;
                    _isOrderCreated = true;
                    _createdOrderId = orderId;
                  });
                } else if (status == 'FAILED' || status == 'CANCELLED') {
                  timer.cancel();
                  setState(() => _isProcessing = false);
                  _showPaymentErrorDialog('Payment was declined or cancelled. Please try again.');
                }
              }
            } catch (e) {
              debugPrint('Error polling status: $e');
            }
          });
        } else {
          String errMsg = 'Failed to initiate payment. Please try again.';
          try {
            final resBody = jsonDecode(response.body);
            if (resBody['message'] != null) {
              errMsg = resBody['message'];
            }
          } catch (_) {}
          setState(() => _isProcessing = false);
          _showPaymentErrorDialog(errMsg);
        }
      } else {
        // COD path - create order immediately
        final response = await ApiService.post('/customer/orders', payload);

        if (response.statusCode == 200 || response.statusCode == 201) {
          final resBody = jsonDecode(response.body);
          final orderId = resBody['orderId'] ?? resBody['id'];

          await CartService.clearCart();

          setState(() {
            _isProcessing = false;
            _isOrderCreated = true;
            _createdOrderId = orderId;
          });
        } else {
          String errMsg = 'Failed to place order. Please try again.';
          var shouldClearStaleCart = false;
          try {
            final resBody = jsonDecode(response.body);
            if (resBody['message'] != null) {
              errMsg = resBody['message'];
            }
            shouldClearStaleCart = resBody['code'] == 'STALE_ORDER_DATA';
          } catch (_) {}

          if (shouldClearStaleCart) {
            await CartService.clearCart();
            errMsg =
                '$errMsg\n\nYour old cart has been cleared. Please choose items again.';
          }

          setState(() => _isProcessing = false);
          _showPaymentErrorDialog(errMsg);
        }
      }
    } catch (e) {
      debugPrint('DEBUG: Error processing checkout: $e');
      setState(() => _isProcessing = false);
      _showPaymentErrorDialog('Network error. Please check your connection.');
    }
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<ThemeProvider>(context); // listen for theme changes
    final rawArgs = ModalRoute.of(context)?.settings.arguments;
    final args = rawArgs is Map
        ? Map<String, dynamic>.from(rawArgs)
        : <String, dynamic>{};

    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    final bgColor = theme.scaffoldBackgroundColor;
    final textPrimary = cs.onSurface;
    final textSecondary = isDark
        ? AppColors.textSecondaryDark
        : AppColors.textSecondary;
    final borderCol = isDark ? AppColors.borderDark : AppColors.border;

    if (_isProcessing) {
      return Scaffold(
        backgroundColor: bgColor,
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 140,
                height: 140,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.primary.withAlpha(20),
                  shape: BoxShape.circle,
                ),
                child: const CircularProgressIndicator(
                  strokeWidth: 4,
                  valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                ),
              ),
              const SizedBox(height: AppSpacing.xxl),
              Text(
                'Processing Order',
                style: TextStyle(
                  color: textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                child: Text(
                  _processingStep,
                  key: ValueKey<String>(_processingStep),
                  style: TextStyle(color: textSecondary, fontSize: 15),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (!_isOrderCreated) {
      // PRE-CONFIRMATION (ORDER REVIEW) SCREEN
      final cartItemsRaw = args['cart_items'];
      final List<CartItemModel> cartItems = [];
      if (cartItemsRaw is List) {
        for (var item in cartItemsRaw) {
          if (item is CartItemModel) {
            cartItems.add(item);
          }
        }
      }

      final subtotal =
          double.tryParse(args['subtotal']?.toString() ?? '0') ?? 0.0;
      final deliveryFee =
          double.tryParse(args['delivery_fee']?.toString() ?? '0') ?? 0.0;
      final effectiveDeliveryFee =
          double.tryParse(args['effective_delivery_fee']?.toString() ?? '') ??
          deliveryFee;
      final discountAmount =
          double.tryParse(args['discount_amount']?.toString() ?? '0') ?? 0.0;
      final payableSubtotal = (subtotal - discountAmount).clamp(
        0.0,
        double.infinity,
      );
      final grandTotal = (payableSubtotal + effectiveDeliveryFee).clamp(
        0.0,
        double.infinity,
      );

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
            'Review Order',
            style: TextStyle(
              color: textPrimary,
              fontWeight: FontWeight.bold,
              fontSize: 18,
            ),
          ),
          centerTitle: true,
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(1),
            child: Container(color: borderCol.withAlpha(76), height: 1),
          ),
        ),
        body: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(AppSpacing.l),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Step Indicator
                      _buildStepIndicator(context),
                      const SizedBox(height: AppSpacing.xl),

                      // Deliver to section
                      _buildSectionTitle(
                        context,
                        'Delivery Address',
                        Icons.location_on,
                      ),
                      _buildCard(
                        context,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              args['delivery_address']?.toString() ??
                                  'Mogadishu',
                              style: TextStyle(
                                color: textPrimary,
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (args['delivery_zone'] != null &&
                                args['delivery_zone']
                                    .toString()
                                    .isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                'Zone: ${args['delivery_zone']}',
                                style: TextStyle(
                                  color: textSecondary,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),

                      // Delivery Schedule section
                      if (args['delivery_date'] != null ||
                          args['delivery_slot'] != null) ...[
                        _buildSectionTitle(
                          context,
                          'Delivery Schedule',
                          Icons.event_available,
                        ),
                        _buildCard(
                          context,
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withAlpha(25),
                                  borderRadius: BorderRadius.circular(
                                    AppSpacing.radiusM,
                                  ),
                                ),
                                child: const Icon(
                                  Icons.access_time,
                                  color: AppColors.primary,
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      args['delivery_date']?.toString() ??
                                          'Today',
                                      style: TextStyle(
                                        color: textPrimary,
                                        fontSize: 15,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    if (args['delivery_slot'] != null) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        '${args['delivery_slot']}',
                                        style: TextStyle(
                                          color: textSecondary,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ],
                                    if (args['delivery_time_range'] !=
                                        null) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        '${args['delivery_time_range']}',
                                        style: TextStyle(
                                          color: AppColors.primary,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xl),
                      ],

                      // Payment Method section
                      _buildSectionTitle(
                        context,
                        'Payment Method',
                        Icons.payment,
                      ),
                      _buildCard(
                        context,
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withAlpha(25),
                                borderRadius: BorderRadius.circular(
                                  AppSpacing.radiusM,
                                ),
                              ),
                              child: const Icon(
                                Icons.account_balance_wallet,
                                color: AppColors.primary,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    args['payment_method_name']?.toString() ??
                                        'Selected Method',
                                    style: TextStyle(
                                      color: textPrimary,
                                      fontSize: 15,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  if (args['payment_phone'] != null &&
                                      args['payment_phone']
                                          .toString()
                                          .isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      'Phone: ${args['payment_phone']}',
                                      style: TextStyle(
                                        color: textSecondary,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),

                      // Items summary
                      _buildSectionTitle(
                        context,
                        'Items Summary',
                        Icons.shopping_bag,
                      ),
                      if (cartItems.isNotEmpty)
                        ...cartItems.map(
                          (item) => Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8.0),
                            child: Row(
                              children: [
                                Container(
                                  width: 48,
                                  height: 48,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(
                                      AppSpacing.radiusM,
                                    ),
                                    color: isDark
                                        ? Colors.white.withAlpha(10)
                                        : Colors.black.withAlpha(10),
                                  ),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(
                                      AppSpacing.radiusM,
                                    ),
                                    child:
                                        item.imageUrl.startsWith('http') ||
                                            item.imageUrl.startsWith('/uploads')
                                        ? Image.network(
                                            item.imageUrl,
                                            fit: BoxFit.cover,
                                            errorBuilder: (c, e, s) =>
                                                const Icon(
                                                  Icons.image,
                                                  size: 20,
                                                ),
                                          )
                                        : Image.asset(
                                            item.imageUrl,
                                            fit: BoxFit.cover,
                                            errorBuilder: (c, e, s) =>
                                                const Icon(
                                                  Icons.image,
                                                  size: 20,
                                                ),
                                          ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.title,
                                        style: TextStyle(
                                          color: textPrimary,
                                          fontSize: 14,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      Text(
                                        item.unit.isNotEmpty
                                            ? '${item.quantity} ${item.unit}'
                                            : 'x${item.quantity}',
                                        style: TextStyle(
                                          color: textSecondary,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Text(
                                  '\$${(item.price * item.quantity).toStringAsFixed(2)}',
                                  style: TextStyle(
                                    color: textPrimary,
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      else
                        Text(
                          'No items found',
                          style: TextStyle(color: textSecondary),
                        ),
                      const SizedBox(height: AppSpacing.xl),

                      // Price Summary Card
                      _buildSectionTitle(
                        context,
                        'Cost Summary',
                        Icons.receipt_long,
                      ),
                      _buildCard(
                        context,
                        child: Column(
                          children: [
                            _buildSummaryRow(
                              context,
                              'Subtotal',
                              '\$${payableSubtotal.toStringAsFixed(2)}',
                              isBorder: false,
                            ),
                            const SizedBox(height: 8),
                            _buildSummaryRow(
                              context,
                              'Delivery Fee',
                              effectiveDeliveryFee == 0.0
                                  ? 'FREE'
                                  : '\$${effectiveDeliveryFee.toStringAsFixed(2)}',
                              isBorder: false,
                              valueColor: effectiveDeliveryFee == 0.0
                                  ? AppColors.success
                                  : null,
                            ),
                            if (discountAmount > 0 ||
                                args['offer_id'] != null) ...[
                              const SizedBox(height: 8),
                              _buildSummaryRow(
                                context,
                                args['offer_description']?.toString() ??
                                    'Offer',
                                discountAmount > 0
                                    ? 'Saved \$${discountAmount.toStringAsFixed(2)}'
                                    : 'Applied',
                                isBorder: false,
                                valueColor: AppColors.success,
                              ),
                            ],
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 8.0),
                              child: Divider(),
                            ),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Total Amount',
                                  style: TextStyle(
                                    color: textPrimary,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  '\$${grandTotal.toStringAsFixed(2)}',
                                  style: const TextStyle(
                                    color: AppColors.primary,
                                    fontSize: 20,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
              // Footer Confirm Button
              Container(
                padding: const EdgeInsets.all(AppSpacing.l),
                decoration: BoxDecoration(
                  color: bgColor,
                  border: Border(
                    top: BorderSide(color: borderCol.withAlpha(76)),
                  ),
                ),
                child: CustomButton(
                  text: 'Confirm & Place Order',
                  onPressed: () => _confirmAndPlaceOrder(args),
                  icon: const Icon(
                    Icons.check_circle_outline,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    // POST-CONFIRMATION (SUCCESS) STATE
    final orderId = _createdOrderId;
    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: bgColor,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pushNamedAndRemoveUntil(
            context,
            AppRoutes.home,
            (route) => false,
          ),
          icon: Icon(Icons.close, color: textPrimary),
        ),
        title: Text(
          'Order Status',
          style: TextStyle(
            color: textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        centerTitle: true,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: borderCol.withAlpha(76), height: 1),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.l,
            vertical: AppSpacing.xxl,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Success Icon
              Center(
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        color: AppColors.success.withAlpha(25),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const Icon(
                      Icons.check_circle,
                      color: AppColors.success,
                      size: 80,
                      shadows: [
                        Shadow(color: AppColors.success, blurRadius: 20),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xl),

              Text(
                'Order Placed Successfully!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: textPrimary,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Your order is being processed and will be delivered shortly to your location.',
                textAlign: TextAlign.center,
                style: TextStyle(color: textSecondary, fontSize: 15),
              ),
              const SizedBox(height: AppSpacing.xxl),

              // Order Summary Card
              _buildSuccessSummaryCard(context, orderId, args),

              const SizedBox(height: AppSpacing.xxl),

              // Action Buttons
              CustomButton(
                text: 'Track Order',
                onPressed: () {
                  if (orderId != null) {
                    Navigator.pushNamed(
                      context,
                      AppRoutes.status,
                      arguments: {'id': orderId},
                    );
                  } else {
                    debugPrint(
                      'DEBUG: [OrderConfirmationScreen] missing orderId, cannot track',
                    );
                    _showErrorSnackBar(
                      'Order ID missing, please check Orders history',
                    );
                  }
                },
                icon: const Icon(Icons.local_shipping, color: Colors.white),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: OutlinedButton(
                  onPressed: () => Navigator.pushNamedAndRemoveUntil(
                    context,
                    AppRoutes.home,
                    (route) => false,
                  ),
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(
                      color: AppColors.primary.withAlpha(51),
                      width: 2,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppSpacing.radiusL),
                    ),
                  ),
                  child: const Text(
                    'Back to Home',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStepIndicator(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final activeColor = AppColors.primary;
    final inactiveColor = isDark
        ? Colors.white.withAlpha(20)
        : Colors.black.withAlpha(10);
    final textSecondary = isDark
        ? AppColors.textSecondaryDark
        : AppColors.textSecondary;

    Widget buildStep(String label, bool isDone, bool isActive) {
      return Column(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: isDone
                  ? activeColor
                  : (isActive ? activeColor.withAlpha(51) : inactiveColor),
              shape: BoxShape.circle,
              border: isActive
                  ? Border.all(color: activeColor, width: 2)
                  : null,
            ),
            child: Center(
              child: isDone
                  ? const Icon(Icons.check, color: Colors.white, size: 16)
                  : Text(
                      label[0],
                      style: TextStyle(
                        color: isActive
                            ? activeColor
                            : (isDark ? Colors.white70 : Colors.black87),
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              color: isActive ? activeColor : textSecondary,
              fontSize: 10,
              fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      );
    }

    Widget buildDivider() {
      return Expanded(
        child: Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Container(height: 2, color: activeColor.withAlpha(100)),
        ),
      );
    }

    return Row(
      children: [
        buildStep('Cart', true, false),
        buildDivider(),
        buildStep('Checkout', true, false),
        buildDivider(),
        buildStep('Schedule', true, false),
        buildDivider(),
        buildStep('Payment', true, false),
        buildDivider(),
        buildStep('Confirm', false, true),
      ],
    );
  }

  Widget _buildSectionTitle(BuildContext context, String title, IconData icon) {
    final theme = Theme.of(context);
    final textPrimary = theme.colorScheme.onSurface;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0, left: 4.0),
      child: Row(
        children: [
          Icon(icon, color: AppColors.primary, size: 18),
          const SizedBox(width: 8),
          Text(
            title,
            style: TextStyle(
              color: textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCard(BuildContext context, {required Widget child}) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final cardBg = isDark
        ? AppColors.surfaceDark.withAlpha(76)
        : Colors.grey.shade100;
    final borderCol = isDark ? AppColors.borderDark : AppColors.border;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.l),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(AppSpacing.radiusXL),
        border: Border.all(color: borderCol.withAlpha(76)),
      ),
      child: child,
    );
  }

  Widget _buildSuccessSummaryCard(
    BuildContext context,
    dynamic orderId,
    Map<String, dynamic> args,
  ) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final borderColor = isDark ? AppColors.borderDark : AppColors.border;
    final cardBg = isDark
        ? AppColors.surfaceDark.withAlpha(76)
        : Colors.grey.shade100;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(AppSpacing.radiusXL),
        border: Border.all(color: borderColor.withAlpha(127)),
      ),
      child: Column(
        children: [
          // Order status header
          Container(
            height: 116,
            width: double.infinity,
            decoration: BoxDecoration(
              color: AppColors.primary.withAlpha(isDark ? 38 : 24),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(AppSpacing.radiusXL),
              ),
            ),
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.success,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                    ),
                    child: const Icon(
                      Icons.check,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: isDark
                          ? AppColors.backgroundDark.withAlpha(204)
                          : AppColors.primary,
                      borderRadius: BorderRadius.circular(AppSpacing.radiusS),
                    ),
                    child: const Text(
                      'ORDER RECEIVED',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Summary Details
          Padding(
            padding: const EdgeInsets.all(AppSpacing.l),
            child: Column(
              children: [
                _buildSummaryRow(
                  context,
                  'Order ID',
                  orderId != null ? '#ORD-$orderId' : 'Pending',
                  isBoldValue: true,
                  valueColor: AppColors.primary,
                ),
                const SizedBox(height: 12),
                _buildSummaryRow(
                  context,
                  'Estimated Arrival',
                  () {
                    final date = args['delivery_date']?.toString();
                    final timeRange = args['delivery_time_range']?.toString();
                    if (date != null && timeRange != null) {
                      return '$date · $timeRange';
                    } else if (date != null) {
                      return date;
                    }
                    return 'To be confirmed';
                  }(),
                  isBoldValue: true,
                  icon: Icons.schedule,
                ),
                const SizedBox(height: 12),
                _buildSummaryRow(
                  context,
                  'Payment Method',
                  args['payment_method_name']?.toString() ?? 'Not provided',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(
    BuildContext context,
    String label,
    String value, {
    bool isBoldValue = false,
    Color? valueColor,
    IconData? icon,
    bool isBorder = true,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final textPrimary = theme.colorScheme.onSurface;
    final textSecondary = isDark
        ? AppColors.textSecondaryDark
        : AppColors.textSecondary;
    final borderColor = isDark ? AppColors.borderDark : AppColors.border;

    return Container(
      padding: EdgeInsets.only(bottom: isBorder ? 12 : 0),
      decoration: isBorder
          ? BoxDecoration(
              border: Border(
                bottom: BorderSide(color: borderColor.withAlpha(76)),
              ),
            )
          : null,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 4,
            child: Text(
              label,
              style: TextStyle(
                color: textSecondary,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 6,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (icon != null) ...[
                  const SizedBox(width: 4),
                  Icon(icon, color: AppColors.primary, size: 14),
                  const SizedBox(width: 4),
                ],
                Flexible(
                  child: Text(
                    value,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      color: valueColor ?? textPrimary,
                      fontWeight: isBoldValue
                          ? FontWeight.bold
                          : FontWeight.w500,
                      fontSize: 14,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
