import 'package:flutter/material.dart';

class TimeSlotModel {
  final String id;
  final String label;
  final String timeRange;
  final IconData icon;
  final String? tag;
  final bool isExpress;

  const TimeSlotModel({
    required this.id,
    required this.label,
    required this.timeRange,
    required this.icon,
    this.tag,
    this.isExpress = false,
  });

  static const List<TimeSlotModel> slots = [
    TimeSlotModel(
      id: 'express',
      label: 'Express',
      timeRange: 'Within 60 mins • High Demand',
      icon: Icons.bolt,
      tag: 'FASTEST',
      isExpress: true,
    ),
    TimeSlotModel(
      id: 'morning',
      label: 'Morning',
      timeRange: '6:00 AM - 12:00 PM',
      icon: Icons.light_mode,
    ),
    TimeSlotModel(
      id: 'afternoon',
      label: 'Afternoon',
      timeRange: '12:00 PM - 6:00 PM',
      icon: Icons.wb_sunny,
    ),
    TimeSlotModel(
      id: 'evening',
      label: 'Evening',
      timeRange: '6:00 PM - 12:00 AM',
      icon: Icons.bedtime,
    ),
    TimeSlotModel(
      id: 'midnight',
      label: 'Midnight',
      timeRange: '12:00 AM - 6:00 AM',
      icon: Icons.nightlight_round,
    ),
  ];
}
