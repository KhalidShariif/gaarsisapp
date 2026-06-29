import 'package:flutter/material.dart';

enum PaymentType { cash, waafiy, airtel, card }

class PaymentMethodModel {
  final String name;
  final String subtitle;
  final String? imageUrl;
  final IconData? icon;
  final PaymentType type;

  /// The exact string sent to the backend as payment_method
  final String apiKey;

  PaymentMethodModel({
    required this.name,
    required this.subtitle,
    this.imageUrl,
    this.icon,
    required this.type,
    required this.apiKey,
  });

  static List<PaymentMethodModel> get methods => [
    PaymentMethodModel(
      name: 'Cash on Delivery',
      subtitle: 'Pay in cash when you receive your order',
      icon: Icons.payments_outlined,
      type: PaymentType.cash,
      apiKey: 'COD',
    ),
    PaymentMethodModel(
      name: 'Wallet',
      subtitle: 'WAAFI/EVC prompt will be sent to your phone',
      imageUrl: 'assets/images/image.png',
      type: PaymentType.waafiy,
      apiKey: 'Wallet',
    ),
    PaymentMethodModel(
      name: 'EVC Plus',
      subtitle: 'Hormuud Telesom mobile money',
      icon: Icons.phone_android_outlined,
      type: PaymentType.airtel,
      apiKey: 'EVC Plus',
    ),
    PaymentMethodModel(
      name: 'Zaad',
      subtitle: 'Telesom Zaad mobile money',
      icon: Icons.phone_android_outlined,
      type: PaymentType.airtel,
      apiKey: 'Zaad',
    ),
    PaymentMethodModel(
      name: 'Sahal',
      subtitle: 'Somtel Sahal mobile money',
      icon: Icons.phone_android_outlined,
      type: PaymentType.airtel,
      apiKey: 'Sahal',
    ),
    PaymentMethodModel(
      name: 'Credit / Debit Card',
      subtitle: 'Visa, Mastercard',
      icon: Icons.credit_card_outlined,
      type: PaymentType.card,
      apiKey: 'Card',
    ),
  ];
}
