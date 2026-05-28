import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

void main() {
  runApp(const SpotterCompanionApp());
}

class SpotterCompanionApp extends StatelessWidget {
  const SpotterCompanionApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Spotter Companion',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff176b5f)),
        scaffoldBackgroundColor: const Color(0xfff7faf8),
        useMaterial3: true,
      ),
      home: const PairingHomePage(),
    );
  }
}

class PairingHomePage extends StatefulWidget {
  const PairingHomePage({super.key});

  @override
  State<PairingHomePage> createState() => _PairingHomePageState();
}

class _PairingHomePageState extends State<PairingHomePage> {
  final _bridge = NativeCompanionBridge();
  PairingState? _state;
  Timer? _poller;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _refresh();
    _poller = Timer.periodic(const Duration(seconds: 2), (_) => _refresh());
  }

  @override
  void dispose() {
    _poller?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final state = await _bridge.getState();
      if (!mounted) return;
      setState(() {
        _state = state;
        _error = null;
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      await _refresh();
    } on Object catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = _state;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Spotter Companion'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _busy ? null : _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            _HeroPanel(state: state, busy: _busy),
            const SizedBox(height: 16),
            if (_error != null) _ErrorPanel(message: _error!),
            _PairingPanel(
              state: state,
              busy: _busy,
              onStart: () => _run(_bridge.startPairingServer),
              onStop: () => _run(_bridge.stopPairingServer),
              onRegenerate: () => _run(_bridge.regeneratePairingCode),
            ),
            const SizedBox(height: 16),
            _PermissionsPanel(
              state: state,
              onAccessibility: () => _run(_bridge.openAccessibilitySettings),
              onScreenCapture: () => _run(_bridge.requestScreenCapture),
            ),
            const SizedBox(height: 16),
            _CapabilitiesPanel(capabilities: state?.capabilities ?? const {}),
            const SizedBox(height: 16),
            _EventsPanel(events: state?.events ?? const []),
          ],
        ),
      ),
    );
  }
}

class _HeroPanel extends StatelessWidget {
  const _HeroPanel({required this.state, required this.busy});

  final PairingState? state;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final connected = state?.connectedClient != null;
    final status = connected
        ? 'Connected'
        : state?.running == true
        ? 'Waiting for pairing'
        : 'Server stopped';
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xffffffff),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xffd9e6df)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                connected ? Icons.link : Icons.phone_android,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  status,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              if (busy)
                const SizedBox.square(
                  dimension: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            connected
                ? 'Desktop client: ${state!.connectedClient}'
                : 'Use the address and six digit pairing code from the desktop bridge.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}

class _PairingPanel extends StatelessWidget {
  const _PairingPanel({
    required this.state,
    required this.busy,
    required this.onStart,
    required this.onStop,
    required this.onRegenerate,
  });

  final PairingState? state;
  final bool busy;
  final VoidCallback onStart;
  final VoidCallback onStop;
  final VoidCallback onRegenerate;

  @override
  Widget build(BuildContext context) {
    final uri = state?.uri ?? 'ws://0.0.0.0:0';
    final code = state?.pairingCode ?? '------';
    return _Section(
      title: 'Pairing',
      child: Column(
        children: [
          _InfoTile(label: 'Address', value: uri, icon: Icons.dns_outlined),
          _InfoTile(
            label: 'Pairing code',
            value: code,
            icon: Icons.pin_outlined,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: busy ? null : onStart,
                  icon: const Icon(Icons.play_arrow),
                  label: const Text('Start'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: busy ? null : onRegenerate,
                  icon: const Icon(Icons.autorenew),
                  label: const Text('Code'),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.outlined(
                tooltip: 'Stop server',
                onPressed: busy ? null : onStop,
                icon: const Icon(Icons.stop),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PermissionsPanel extends StatelessWidget {
  const _PermissionsPanel({
    required this.state,
    required this.onAccessibility,
    required this.onScreenCapture,
  });

  final PairingState? state;
  final VoidCallback onAccessibility;
  final VoidCallback onScreenCapture;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Permissions',
      child: Column(
        children: [
          _PermissionRow(
            label: 'Accessibility service',
            granted: state?.accessibilityEnabled ?? false,
            onTap: onAccessibility,
          ),
          const Divider(height: 1),
          _PermissionRow(
            label: 'Screen capture session',
            granted: state?.screenCaptureReady ?? false,
            onTap: onScreenCapture,
          ),
        ],
      ),
    );
  }
}

class _CapabilitiesPanel extends StatelessWidget {
  const _CapabilitiesPanel({required this.capabilities});

  final Map<String, bool> capabilities;

  @override
  Widget build(BuildContext context) {
    final keys = capabilities.keys.toList()..sort();
    return _Section(
      title: 'Capabilities',
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final key in keys)
            Chip(
              avatar: Icon(
                capabilities[key] == true
                    ? Icons.check_circle
                    : Icons.lock_outline,
                size: 18,
              ),
              label: Text(key),
            ),
        ],
      ),
    );
  }
}

class _EventsPanel extends StatelessWidget {
  const _EventsPanel({required this.events});

  final List<String> events;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Events',
      child: events.isEmpty
          ? const Text('No events yet.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final event in events.reversed.take(8))
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Text(event),
                  ),
              ],
            ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xffd9e6df)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon),
      title: Text(label),
      subtitle: SelectableText(value),
    );
  }
}

class _PermissionRow extends StatelessWidget {
  const _PermissionRow({
    required this.label,
    required this.granted,
    required this.onTap,
  });

  final String label;
  final bool granted;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      subtitle: Text(granted ? 'Ready' : 'Needs user approval'),
      trailing: Icon(granted ? Icons.check_circle : Icons.chevron_right),
      onTap: granted ? null : onTap,
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Material(
        color: const Color(0xfffff1f1),
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              const Icon(Icons.error_outline),
              const SizedBox(width: 8),
              Expanded(child: Text(message)),
            ],
          ),
        ),
      ),
    );
  }
}

class NativeCompanionBridge {
  static const _channel = MethodChannel('spotter.mobile_companion/native');

  Future<PairingState> getState() async {
    final raw = await _channel.invokeMapMethod<String, Object?>('getState');
    return PairingState.fromMap(raw ?? const {});
  }

  Future<void> startPairingServer() =>
      _channel.invokeMethod('startPairingServer');
  Future<void> stopPairingServer() =>
      _channel.invokeMethod('stopPairingServer');
  Future<void> regeneratePairingCode() =>
      _channel.invokeMethod('regeneratePairingCode');
  Future<void> openAccessibilitySettings() =>
      _channel.invokeMethod('openAccessibilitySettings');
  Future<void> requestScreenCapture() =>
      _channel.invokeMethod('requestScreenCapture');
}

class PairingState {
  const PairingState({
    required this.running,
    required this.host,
    required this.port,
    required this.pairingCode,
    required this.connectedClient,
    required this.accessibilityEnabled,
    required this.screenCaptureReady,
    required this.capabilities,
    required this.events,
  });

  final bool running;
  final String host;
  final int port;
  final String pairingCode;
  final String? connectedClient;
  final bool accessibilityEnabled;
  final bool screenCaptureReady;
  final Map<String, bool> capabilities;
  final List<String> events;

  String get uri => 'ws://$host:$port';

  factory PairingState.fromMap(Map<Object?, Object?> map) {
    return PairingState(
      running: map['running'] == true,
      host: (map['host'] as String?) ?? '0.0.0.0',
      port: (map['port'] as int?) ?? 0,
      pairingCode: (map['pairingCode'] as String?) ?? '------',
      connectedClient: map['connectedClient'] as String?,
      accessibilityEnabled: map['accessibilityEnabled'] == true,
      screenCaptureReady: map['screenCaptureReady'] == true,
      capabilities: _boolMap(map['capabilities']),
      events: ((map['events'] as List<Object?>?) ?? const [])
          .whereType<String>()
          .toList(),
    );
  }

  static Map<String, bool> _boolMap(Object? value) {
    final raw = value as Map<Object?, Object?>? ?? const {};
    return raw.map((key, value) => MapEntry(key.toString(), value == true));
  }
}
