import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:deliveryapp/core/theme/theme_provider.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../shared/widgets/custom_button.dart';
import '../../../../core/routes/app_routes.dart';
import '../../../../core/utils/cart_service.dart';
import '../models/cart_item_model.dart';
import '../models/payment_method_model.dart';

class PaymentMethodSelectionScreen extends StatefulWidget {
  const PaymentMethodSelectionScreen({super.key});

  @override
  State<PaymentMethodSelectionScreen> createState() =>
      _PaymentMethodSelectionScreenState();
}

class _PaymentMethodSelectionScreenState
    extends State<PaymentMethodSelectionScreen> {
  int? _selectedMethodIndex;
  Map<String, dynamic>? _orderArgs;

  // Form keys
  final _phoneFormKey = GlobalKey<FormState>();
  final _cardFormKey = GlobalKey<FormState>();

  // COD controllers
  final _cashNameController = TextEditingController();
  final _cashPhoneController = TextEditingController();

  // Mobile money / wallet PIN controllers
  final _mobilePhoneController = TextEditingController();
  final _pinController = TextEditingController();

  // Card controllers
  final _cardNameController = TextEditingController();
  final _cardNumberController = TextEditingController();
  final _expiryDateController = TextEditingController();
  final _cvvController = TextEditingController();
  String _selectedCardType = 'Visa';

  static const Map<String, String> _merchantCodes = {
    'EVC Plus': '0616667746',
    'Zaad': '0616667746',
    'Sahal': '0616667746',
  };

  static const Map<String, String> _ussdTemplates = {
    'EVC Plus': '*712*{merchant}*{amount}#',
    'Zaad': '*222*{merchant}*{amount}#',
    'Sahal': '*223*{merchant}*{amount}#',
  };

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final rawArgs = ModalRoute.of(context)?.settings.arguments;
    if (rawArgs != null && rawArgs is Map) {
      _orderArgs = Map<String, dynamic>.from(rawArgs);
    } else {
      _orderArgs = <String, dynamic>{};
    }
  }

  @override
  void dispose() {
    _cashNameController.dispose();
    _cashPhoneController.dispose();
    _mobilePhoneController.dispose();
    _pinController.dispose();
    _cardNameController.dispose();
    _cardNumberController.dispose();
    _expiryDateController.dispose();
    _cvvController.dispose();
    super.dispose();
  }

  Map<String, dynamic> _resolvedOrderArgs() {
    final args = Map<String, dynamic>.from(_orderArgs ?? {});

    final rawProduct = args['product'];
    final rawVendor = args['vendor'];
    final product = rawProduct is Map
        ? Map<String, dynamic>.from(rawProduct)
        : null;
    final vendor = rawVendor is Map
        ? Map<String, dynamic>.from(rawVendor)
        : null;

    if (args['items'] == null && product != null && vendor != null) {
      final productId = _parseInt(product['id'] ?? product['product_id']);
      final vendorId = _parseInt(
        vendor['id'] ?? vendor['vendor_id'] ?? product['vendor_id'],
      );
      final rawQuantity = _parseDouble(args['quantity']) ?? 1;
      final quantity = rawQuantity.ceil() < 1 ? 1 : rawQuantity.ceil();
      final price =
          _parseDouble(product['price'] ?? product['selling_price']) ?? 0;
      final subtotal = _parseDouble(args['total']) ?? (price * quantity);

      if (productId != null && vendorId != null && price > 0) {
        final productName =
            (product['product_name'] ?? product['name'] ?? 'Product')
                .toString();
        final vendorName =
            (vendor['vendor_name'] ??
                    vendor['business_name'] ??
                    vendor['name'] ??
                    '')
                .toString();

        args['vendor_id'] = vendorId;
        args['items'] = [
          {
            'product_id': productId,
            'vendor_id': vendorId,
            'quantity': quantity,
            'price': price,
          },
        ];
        args['subtotal'] = subtotal;
        args['delivery_fee'] = args['delivery_fee'] ?? 0;
        args['delivery_address'] =
            args['delivery_address'] ?? args['delivery_zone'] ?? 'Mogadishu';
        args['cart_items'] = [
          CartItemModel(
            id: productId.toString(),
            title: productName,
            subtitle: vendorName.isEmpty ? null : vendorName,
            imageUrl: (product['image_url'] ?? product['image'] ?? '')
                .toString(),
            price: price,
            priceUnit: '',
            quantity: quantity,
            vendorId: vendorId,
            vendorName: vendorName.isEmpty ? null : vendorName,
            unit: (args['unit'] ?? product['unit'] ?? '').toString(),
            stock:
                _parseInt(product['stock'] ?? product['stock_quantity']) ??
                quantity,
            isActive: product['is_active'] != false,
          ),
        ];
      }
    }

    final activeOffer = args['offer'] is Map
        ? Map<String, dynamic>.from(args['offer'] as Map)
        : CartService.activeOffer;
    final vendorId = _parseInt(args['vendor_id']);
    final offerVendorId = _parseInt(activeOffer?['vendor_id']);
    if (activeOffer != null &&
        (offerVendorId == null ||
            vendorId == null ||
            offerVendorId == vendorId)) {
      args['offer'] = activeOffer;
      args['offer_id'] = args['offer_id'] ?? activeOffer['id'];
      args['offer_description'] =
          args['offer_description'] ??
          (activeOffer['name'] ?? activeOffer['title'] ?? 'Offer').toString();

      final subtotal = _parseDouble(args['subtotal']) ?? 0;
      final deliveryFee = _parseDouble(args['delivery_fee']) ?? 0;
      args['discount_amount'] =
          args['discount_amount'] ??
          _calculateOfferDiscount(activeOffer, args['items'], subtotal);
      args['effective_delivery_fee'] =
          args['effective_delivery_fee'] ??
          (activeOffer['offer_type']?.toString() == 'free_delivery'
              ? 0
              : deliveryFee);
    }

    return args;
  }

  double _calculateOfferDiscount(
    Map<String, dynamic> offer,
    dynamic items,
    double subtotal,
  ) {
    final type = offer['offer_type']?.toString() ?? 'percentage';
    final value =
        _parseDouble(offer['discount_value'] ?? offer['discount_percentage']) ??
        0;
    if (value <= 0) return 0;

    if (type == 'fixed_amount') {
      return value > subtotal ? subtotal : value;
    }
    if (type == 'product_specific') {
      final productId = _parseInt(offer['product_id']);
      if (productId == null || items is! List) return 0;
      double itemSubtotal = 0;
      for (final item in items) {
        if (item is Map && _parseInt(item['product_id']) == productId) {
          final price = _parseDouble(item['price']) ?? 0;
          final quantity = _parseDouble(item['quantity']) ?? 0;
          itemSubtotal += price * quantity;
        }
      }
      return itemSubtotal * (value / 100);
    }
    if (type == 'percentage') {
      return subtotal * (value / 100);
    }
    return 0;
  }

  int? _parseInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString());
  }

  double? _parseDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }

  bool _opensMerchantDialer(PaymentMethodModel method) =>
      _merchantCodes.containsKey(method.name);

  bool _usesWaafiPrompt(PaymentMethodModel method) =>
      method.type == PaymentType.waafiy ||
      method.apiKey.toLowerCase() == 'wallet';

  double _grandTotal(Map<String, dynamic> args) {
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
    return (payableSubtotal + effectiveDeliveryFee).clamp(0.0, double.infinity);
  }

  String _merchantDialCode(PaymentMethodModel method, double amount) {
    final merchant = _merchantCodes[method.name]!;
    final template = _ussdTemplates[method.name]!;
    return template
        .replaceAll('{merchant}', merchant)
        .replaceAll('{amount}', amount.toStringAsFixed(2));
  }

  Future<void> _openMerchantDialer(PaymentMethodModel method) async {
    final args = _resolvedOrderArgs();
    final amount = _grandTotal(args);
    final dialCode = _merchantDialCode(method, amount);

    if (kIsWeb) {
      _showDialCodeDialog(method, dialCode);
      return;
    }

    final uri = Uri(scheme: 'tel', path: dialCode);
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && mounted) {
      _showDialCodeDialog(method, dialCode);
    }
  }

  void _showDialCodeDialog(PaymentMethodModel method, String dialCode) {
    if (!mounted) return;
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('${method.name} Merchant Call'),
        content: SelectableText(
          'Dial this merchant code:\n\n$dialCode',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  Future<bool> _confirmWaafiPrompt(
    PaymentMethodModel method,
    String phone,
    double amount,
  ) async {
    if (!_usesWaafiPrompt(method)) return true;
    if (!mounted) return false;

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Approve WAAFI Payment'),
        content: Text(
          'WAAFI/EVC request ayaa loo dirayaa $phone.\n\n'
          'Marka prompt-ku telefoonkaaga ka soo baxo, fadlan taabo Approve/OK si aad u bixiso USD ${amount.toStringAsFixed(2)}.\n\n'
          'Haddii aad Cancel taabato ama prompt-ku kaa dhaco, payment-ku wuu fashilmayaa.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('I am ready'),
          ),
        ],
      ),
    );

    return confirmed == true;
  }

  Future<void> _proceedToReview() async {
    if (_selectedMethodIndex == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select a payment method'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    final method = PaymentMethodModel.methods[_selectedMethodIndex!];
    bool isValid = false;

    // Validate the correct form for the selected payment type
    if (_opensMerchantDialer(method)) {
      isValid = true;
    } else if (method.type == PaymentType.cash) {
      // COD – validate name + phone
      isValid = _phoneFormKey.currentState?.validate() ?? false;
    } else if (method.type == PaymentType.card) {
      isValid = _cardFormKey.currentState?.validate() ?? false;
    } else {
      // Wallet / mobile money – validate phone + PIN form
      isValid = _phoneFormKey.currentState?.validate() ?? false;
    }

    if (!isValid) return;

    // Build the full order details to pass to Order Review
    final args = _resolvedOrderArgs();
    final paymentPhone = _cashPhoneController.text.isNotEmpty
        ? _cashPhoneController.text
        : _mobilePhoneController.text;
    final amount = _grandTotal(args);

    final canContinue = await _confirmWaafiPrompt(method, paymentPhone, amount);
    if (!canContinue || !mounted) return;

    Navigator.pushNamed(
      context,
      AppRoutes.confirmation,
      arguments: {
        // Pass through from price summary
        'vendor_id': args['vendor_id'],
        'items': args['items'],
        'subtotal': args['subtotal'],
        'delivery_fee': args['delivery_fee'],
        'effective_delivery_fee': args['effective_delivery_fee'],
        'discount_amount': args['discount_amount'],
        'offer_id': args['offer_id'],
        'offer': args['offer'],
        'offer_description': args['offer_description'],
        'delivery_zone': args['delivery_zone'],
        'delivery_address': args['delivery_address'],
        'delivery_phone': args['delivery_phone'],
        'delivery_addresses': args['delivery_addresses'],
        'delivery_latitude': args['customer_latitude'],
        'delivery_longitude': args['customer_longitude'],
        'cart_items': args['cart_items'],
        // Delivery scheduling fields (from DeliveryTimeSelectionScreen)
        'delivery_date': args['delivery_date'],
        'delivery_slot': args['delivery_slot'],
        'delivery_time_range': args['delivery_time_range'],
        // Add payment details
        'payment_method': method.apiKey,
        'payment_method_name': method.name,
        'external_merchant_payment': _opensMerchantDialer(method),
        'payment_phone': paymentPhone,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<ThemeProvider>(context); // listen for theme changes
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    final bgColor = theme.scaffoldBackgroundColor;
    final textPrimary = cs.onSurface;
    final borderColor = isDark ? AppColors.borderDark : AppColors.border;

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: bgColor,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.arrow_back, color: AppColors.primary),
        ),
        title: Text(
          'Payment Method',
          style: TextStyle(
            color: textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: borderColor.withAlpha(76), height: 1),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(AppSpacing.l),
                children: [
                  Text(
                    'Select Payment Method',
                    style: TextStyle(
                      color: textPrimary,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Choose how you\'d like to pay for your order',
                    style: TextStyle(
                      color: isDark
                          ? AppColors.textSecondaryDark
                          : AppColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.l),
                  ...List.generate(
                    PaymentMethodModel.methods.length,
                    (index) => _buildPaymentCard(
                      index,
                      PaymentMethodModel.methods[index],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                ],
              ),
            ),
            _buildFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentCard(int index, PaymentMethodModel method) {
    final isSelected = _selectedMethodIndex == index;
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final textPrimary = theme.colorScheme.onSurface;
    final textSecondary = isDark
        ? AppColors.textSecondaryDark
        : AppColors.textSecondary;
    final borderColor = isDark ? AppColors.borderDark : AppColors.border;
    final cardBg = isDark
        ? AppColors.surfaceDark.withAlpha(76)
        : Colors.grey.shade100;

    return Column(
      children: [
        GestureDetector(
          onTap: () {
            setState(() => _selectedMethodIndex = index);
            if (_opensMerchantDialer(method)) {
              _openMerchantDialer(method);
            }
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            margin: const EdgeInsets.only(bottom: AppSpacing.m),
            padding: const EdgeInsets.all(AppSpacing.m),
            decoration: BoxDecoration(
              color: isSelected ? AppColors.primary.withAlpha(15) : cardBg,
              borderRadius: BorderRadius.circular(AppSpacing.radiusXL),
              border: Border.all(
                color: isSelected
                    ? AppColors.primary
                    : borderColor.withAlpha(76),
                width: isSelected ? 2 : 1,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppColors.primary.withAlpha(30)
                        : (isDark
                              ? Colors.white.withAlpha(20)
                              : Colors.black.withAlpha(10)),
                    borderRadius: BorderRadius.circular(AppSpacing.radiusM),
                  ),
                  child: method.imageUrl != null
                      ? Image.asset(method.imageUrl!, fit: BoxFit.contain)
                      : Icon(
                          method.icon,
                          color: isSelected ? AppColors.primary : textSecondary,
                          size: 24,
                        ),
                ),
                const SizedBox(width: AppSpacing.m),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        method.name,
                        style: TextStyle(
                          color: isSelected ? AppColors.primary : textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      Text(
                        method.subtitle,
                        style: TextStyle(color: textSecondary, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isSelected ? AppColors.primary : borderColor,
                      width: 2,
                    ),
                    color: isSelected ? AppColors.primary : Colors.transparent,
                  ),
                  child: isSelected
                      ? const Center(
                          child: Icon(
                            Icons.circle,
                            color: Colors.white,
                            size: 10,
                          ),
                        )
                      : null,
                ),
              ],
            ),
          ),
        ),
        if (isSelected) _buildPaymentDetailsForm(index),
      ],
    );
  }

  Widget _buildPaymentDetailsForm(int index) {
    final method = PaymentMethodModel.methods[index];

    // COD: Name + Phone form
    if (method.type == PaymentType.cash) {
      return Form(
        key: _phoneFormKey,
        child: Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.m),
          child: Column(
            children: [
              _buildTextField(
                controller: _cashNameController,
                hintText: 'Full Name',
                icon: Icons.person_outline,
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Name is required' : null,
              ),
              const SizedBox(height: AppSpacing.m),
              _buildTextField(
                controller: _cashPhoneController,
                hintText: 'Phone Number (optional)',
                icon: Icons.phone_outlined,
                keyboardType: TextInputType.phone,
              ),
            ],
          ),
        ),
      );
    }

    // Card form
    if (method.type == PaymentType.card) {
      return Form(
        key: _cardFormKey,
        child: Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.m),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildCardTypeSelector(),
              const SizedBox(height: AppSpacing.m),
              _buildTextField(
                controller: _cardNameController,
                hintText: 'Cardholder Name',
                icon: Icons.person_outline,
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Name is required' : null,
              ),
              const SizedBox(height: AppSpacing.m),
              _buildTextField(
                controller: _cardNumberController,
                hintText: 'Card Number',
                icon: Icons.credit_card_outlined,
                keyboardType: TextInputType.number,
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Card number is required';
                  return null;
                },
              ),
              const SizedBox(height: AppSpacing.m),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: _buildTextField(
                      controller: _expiryDateController,
                      hintText: 'MM/YY',
                      validator: (v) =>
                          (v == null || v.isEmpty) ? 'Required' : null,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.m),
                  Expanded(
                    child: _buildTextField(
                      controller: _cvvController,
                      hintText: 'CVV',
                      isObscure: true,
                      keyboardType: TextInputType.number,
                      validator: (v) =>
                          (v == null || v.isEmpty) ? 'Required' : null,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    }

    // Wallet / mobile money (Wallet, EVC Plus, Zaad, Sahal): Phone + PIN
    if (_opensMerchantDialer(method)) {
      final dialCode = _merchantDialCode(
        method,
        _grandTotal(_resolvedOrderArgs()),
      );
      return Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.m),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.m),
              decoration: BoxDecoration(
                color: AppColors.primary.withAlpha(18),
                borderRadius: BorderRadius.circular(AppSpacing.radiusL),
                border: Border.all(color: AppColors.primary.withAlpha(80)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Merchant dial code',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  SelectableText(dialCode),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => _openMerchantDialer(method),
                      icon: const Icon(Icons.phone),
                      label: Text('Open ${method.name} Call'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Form(
      key: _phoneFormKey,
      child: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.m),
        child: Column(
          children: [
            _buildTextField(
              controller: _mobilePhoneController,
              hintText: 'Mobile Number',
              icon: Icons.phone_android_outlined,
              keyboardType: TextInputType.phone,
              validator: (v) =>
                  (v == null || v.isEmpty) ? 'Mobile number is required' : null,
            ),
            const SizedBox(height: AppSpacing.m),
            _buildTextField(
              controller: _pinController,
              hintText: 'Enter PIN',
              icon: Icons.lock_outline,
              isObscure: true,
              keyboardType: TextInputType.number,
              validator: (v) {
                if (v == null || v.isEmpty) return 'PIN is required';
                if (v.length < 4) return 'PIN must be at least 4 digits';
                return null;
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCardTypeSelector() {
    return Row(
      children: [
        _buildRadio('Visa'),
        const SizedBox(width: AppSpacing.l),
        _buildRadio('MasterCard'),
      ],
    );
  }

  Widget _buildRadio(String type) {
    final theme = Theme.of(context);
    final textPrimary = theme.colorScheme.onSurface;
    return GestureDetector(
      onTap: () => setState(() => _selectedCardType = type),
      child: Row(
        children: [
          Icon(
            _selectedCardType == type
                ? Icons.radio_button_checked
                : Icons.radio_button_off,
            color: _selectedCardType == type ? AppColors.primary : Colors.grey,
            size: 20,
          ),
          const SizedBox(width: 8),
          Text(type, style: TextStyle(color: textPrimary, fontSize: 14)),
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hintText,
    IconData? icon,
    bool isObscure = false,
    TextInputType keyboardType = TextInputType.text,
    String? Function(String?)? validator,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final textPrimary = theme.colorScheme.onSurface;
    final textSecondary = isDark
        ? AppColors.textSecondaryDark
        : AppColors.textSecondary;
    final borderColor = isDark ? AppColors.borderDark : AppColors.border;
    final inputFill = isDark
        ? AppColors.surfaceDark.withAlpha(76)
        : Colors.grey.shade100;

    return TextFormField(
      controller: controller,
      obscureText: isObscure,
      keyboardType: keyboardType,
      style: TextStyle(color: textPrimary),
      validator: validator,
      decoration: InputDecoration(
        filled: true,
        fillColor: inputFill,
        hintText: hintText,
        hintStyle: TextStyle(color: textSecondary, fontSize: 14),
        prefixIcon: icon != null
            ? Icon(icon, color: textSecondary, size: 20)
            : null,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusL),
          borderSide: BorderSide(color: borderColor.withAlpha(76)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusL),
          borderSide: BorderSide(color: borderColor.withAlpha(76)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusL),
          borderSide: const BorderSide(color: AppColors.primary),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusL),
          borderSide: const BorderSide(color: Colors.redAccent),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusL),
          borderSide: const BorderSide(color: Colors.redAccent),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
      ),
    );
  }

  Widget _buildFooter() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final textSecondary = isDark
        ? AppColors.textSecondaryDark
        : AppColors.textSecondary;
    final borderColor = isDark ? AppColors.borderDark : AppColors.border;
    final footerBg = theme.scaffoldBackgroundColor;

    final args = _resolvedOrderArgs();
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

    return Container(
      padding: const EdgeInsets.all(AppSpacing.l),
      decoration: BoxDecoration(
        color: footerBg,
        border: Border(top: BorderSide(color: borderColor.withAlpha(76))),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Price summary
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Subtotal',
                style: TextStyle(color: textSecondary, fontSize: 13),
              ),
              Text(
                '\$${payableSubtotal.toStringAsFixed(2)}',
                style: TextStyle(color: textSecondary, fontSize: 13),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Delivery Fee',
                style: TextStyle(color: textSecondary, fontSize: 13),
              ),
              Text(
                effectiveDeliveryFee == 0.0
                    ? 'FREE'
                    : '\$${effectiveDeliveryFee.toStringAsFixed(2)}',
                style: TextStyle(
                  color: effectiveDeliveryFee == 0.0
                      ? AppColors.success
                      : textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          if (discountAmount > 0 || args['offer_id'] != null) ...[
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  args['offer_description']?.toString() ?? 'Offer',
                  style: TextStyle(color: textSecondary, fontSize: 13),
                ),
                Text(
                  discountAmount > 0
                      ? 'Saved \$${discountAmount.toStringAsFixed(2)}'
                      : 'Applied',
                  style: const TextStyle(
                    color: AppColors.success,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 12),
          Divider(color: borderColor.withAlpha(76)),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Total Amount',
                style: TextStyle(
                  color: theme.colorScheme.onSurface,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                '\$${grandTotal.toStringAsFixed(2)}',
                style: const TextStyle(
                  color: AppColors.primary,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.l),
          CustomButton(
            text: 'Review Order',
            onPressed: _proceedToReview,
            icon: const Icon(Icons.arrow_forward, color: Colors.white),
          ),
          const SizedBox(height: 12),
          Text(
            'By continuing, you agree to our Terms & Conditions',
            textAlign: TextAlign.center,
            style: TextStyle(color: textSecondary, fontSize: 10),
          ),
        ],
      ),
    );
  }
}
