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
  final _nicknameController = TextEditingController();
  final _nicknameFocus = FocusNode();
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
    _nicknameController.dispose();
    _nicknameFocus.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final state = await _bridge.getState();
      if (!mounted) return;
      setState(() {
        _state = state;
        if (!_nicknameFocus.hasFocus) {
          _nicknameController.text = state.nickname ?? '';
        }
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
            _IdentityPanel(
              state: state,
              busy: _busy,
              nicknameController: _nicknameController,
              nicknameFocus: _nicknameFocus,
              onSubmitted: (value) => _run(() => _bridge.setNickname(value)),
            ),
            const SizedBox(height: 16),
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
              onInputMethod: () => _run(_bridge.openInputMethodSettings),
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

class _IdentityPanel extends StatelessWidget {
  const _IdentityPanel({
    required this.state,
    required this.busy,
    required this.nicknameController,
    required this.nicknameFocus,
    required this.onSubmitted,
  });

  final PairingState? state;
  final bool busy;
  final TextEditingController nicknameController;
  final FocusNode nicknameFocus;
  final ValueChanged<String> onSubmitted;

  @override
  Widget build(BuildContext context) {
    final hardwareName = '${state?.manufacturer ?? ''} ${state?.model ?? ''}'
        .trim();
    final displayName = state?.displayName.isNotEmpty == true
        ? state!.displayName
        : 'Android device';
    return _Section(
      title: 'Device',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _InfoTile(
            label: 'Name',
            value: displayName,
            icon: Icons.smartphone_outlined,
          ),
          _InfoTile(
            label: 'Hardware',
            value: hardwareName.isEmpty
                ? 'Unknown Android device'
                : hardwareName,
            icon: Icons.memory_outlined,
          ),
          const SizedBox(height: 8),
          TextField(
            controller: nicknameController,
            focusNode: nicknameFocus,
            enabled: !busy,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              labelText: 'Nickname',
              prefixIcon: Icon(Icons.edit_outlined),
            ),
            textInputAction: TextInputAction.done,
            onSubmitted: onSubmitted,
          ),
        ],
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
    final listening = state?.running == true;
    final status = _connectionStatusLabel(state);
    final accent = _connectionStatusColor(state);
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
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: accent.withAlpha((0.12 * 255).round()),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: accent.withAlpha((0.28 * 255).round())),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(_connectionStatusIcon(state), size: 16, color: accent),
                    const SizedBox(width: 6),
                    Text(
                      status,
                      style: Theme.of(
                        context,
                      ).textTheme.labelLarge?.copyWith(color: accent),
                    ),
                  ],
                ),
              ),
              const Spacer(),
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
                : listening
                ? 'The pairing endpoint is live on ${state!.uri}.'
                : 'Tap Start listening to expose the pairing endpoint.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 8),
          Text(
            connected
                ? 'The listener is active and paired.'
                : listening
                ? 'Pairing code: ${state?.pairingCode ?? '------'}'
                : 'The listener is offline.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
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
    final listening = state?.running == true;
    return _Section(
      title: 'Listener',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _InfoTile(label: 'Address', value: uri, icon: Icons.dns_outlined),
          _InfoTile(
            label: 'Pairing code',
            value: code,
            icon: Icons.pin_outlined,
          ),
          const SizedBox(height: 8),
          Text(
            listening
                ? 'Listening for desktop clients.'
                : 'Stopped. Start listening to accept a pairing request.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 520;
              final start = FilledButton.icon(
                onPressed: busy || listening ? null : onStart,
                icon: const Icon(Icons.play_arrow),
                label: const Text('Start listening'),
              );
              final stop = FilledButton.icon(
                onPressed: busy || !listening ? null : onStop,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xffb42318),
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: const Color(0xfff4b4af),
                  disabledForegroundColor: const Color(0xff7a1b13),
                ),
                icon: const Icon(Icons.stop),
                label: const Text('Stop listening'),
              );
              final rotate = OutlinedButton.icon(
                onPressed: busy ? null : onRegenerate,
                icon: const Icon(Icons.autorenew),
                label: const Text('Rotate code'),
              );
              if (compact) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    start,
                    const SizedBox(height: 8),
                    stop,
                    const SizedBox(height: 8),
                    rotate,
                  ],
                );
              }
              return Row(
                children: [
                  Expanded(child: start),
                  const SizedBox(width: 8),
                  Expanded(child: stop),
                  const SizedBox(width: 8),
                  rotate,
                ],
              );
            },
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
    required this.onInputMethod,
    required this.onScreenCapture,
  });

  final PairingState? state;
  final VoidCallback onAccessibility;
  final VoidCallback onInputMethod;
  final VoidCallback onScreenCapture;

  @override
  Widget build(BuildContext context) {
    final imeTextReady = state?.capabilities['imeText'] == true;
    return _Section(
      title: 'Permissions',
      child: Column(
        children: [
          _PermissionRow(
            label: 'Accessibility service',
            subtitle: 'Required for tap, swipe, tree, and text input.',
            granted: state?.accessibilityEnabled ?? false,
            onTap: onAccessibility,
          ),
          const Divider(height: 1),
          _PermissionRow(
            label: 'Spotter Keyboard',
            subtitle: state?.inputMethodSelected == true
                ? 'Selected as the active Android keyboard.'
                : 'Enable and select it in Android keyboard settings.',
            granted: state?.inputMethodSelected ?? false,
            onTap: onInputMethod,
          ),
          const Divider(height: 1),
          _PermissionRow(
            label: 'Screen capture session',
            subtitle: 'Required for screenshots and frame capture.',
            granted: state?.screenCaptureReady ?? false,
            onTap: onScreenCapture,
          ),
          const Divider(height: 1),
          _PermissionRow(
            label: 'IME text input',
            subtitle: state?.inputMethodSelected == true
                ? 'Uses Spotter Keyboard to type into the focused field.'
                : 'Falls back to accessibility until Spotter Keyboard is selected.',
            granted: imeTextReady,
            onTap: onInputMethod,
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
    final keys = capabilities.keys.toList()
      ..sort((a, b) => _capabilityOrder(a).compareTo(_capabilityOrder(b)));
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
              label: Text(_capabilityLabel(key)),
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
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: Color(0xffd9e6df)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            child,
          ],
        ),
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
    required this.subtitle,
    required this.granted,
    required this.onTap,
  });

  final String label;
  final String subtitle;
  final bool granted;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      subtitle: Text(subtitle),
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
  Future<void> openInputMethodSettings() =>
      _channel.invokeMethod('openInputMethodSettings');
  Future<void> requestScreenCapture() =>
      _channel.invokeMethod('requestScreenCapture');
  Future<void> setNickname(String? nickname) =>
      _channel.invokeMethod('setNickname', {'nickname': nickname});
}

class PairingState {
  const PairingState({
    required this.running,
    required this.host,
    required this.port,
    required this.pairingCode,
    required this.connectedClient,
    required this.manufacturer,
    required this.model,
    required this.nickname,
    required this.accessibilityEnabled,
    required this.inputMethodEnabled,
    required this.inputMethodSelected,
    required this.screenCaptureReady,
    required this.capabilities,
    required this.events,
  });

  final bool running;
  final String host;
  final int port;
  final String pairingCode;
  final String? connectedClient;
  final String manufacturer;
  final String model;
  final String? nickname;
  final bool accessibilityEnabled;
  final bool inputMethodEnabled;
  final bool inputMethodSelected;
  final bool screenCaptureReady;
  final Map<String, bool> capabilities;
  final List<String> events;

  String get uri => 'ws://$host:$port';
  String get displayName => (nickname?.isNotEmpty ?? false)
      ? nickname!
      : '$manufacturer $model'.trim();

  factory PairingState.fromMap(Map<Object?, Object?> map) {
    return PairingState(
      running: map['running'] == true,
      host: (map['host'] as String?) ?? '0.0.0.0',
      port: (map['port'] as int?) ?? 0,
      pairingCode: (map['pairingCode'] as String?) ?? '------',
      connectedClient: map['connectedClient'] as String?,
      manufacturer: (map['manufacturer'] as String?) ?? '',
      model: (map['model'] as String?) ?? '',
      nickname: map['nickname'] as String?,
      accessibilityEnabled: map['accessibilityEnabled'] == true,
      inputMethodEnabled: map['inputMethodEnabled'] == true,
      inputMethodSelected: map['inputMethodSelected'] == true,
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

String _connectionStatusLabel(PairingState? state) {
  if (state?.connectedClient != null) return 'Connected';
  if (state?.running == true) return 'Listening';
  return 'Stopped';
}

IconData _connectionStatusIcon(PairingState? state) {
  if (state?.connectedClient != null) return Icons.link;
  if (state?.running == true) return Icons.radar;
  return Icons.pause_circle_outline;
}

Color _connectionStatusColor(PairingState? state) {
  if (state?.connectedClient != null) return const Color(0xff0f766e);
  if (state?.running == true) return const Color(0xff1f7a3a);
  return const Color(0xffb42318);
}

String _capabilityLabel(String key) {
  switch (key) {
    case 'accessibilityTree':
      return 'Accessibility tree';
    case 'accessibilityActions':
      return 'Accessibility actions';
    case 'currentApp':
      return 'Current app';
    case 'displayInfo':
      return 'Display info';
    case 'imeText':
      return 'IME text input';
    case 'multiTouch':
      return 'Multi-touch';
    case 'notifications':
      return 'Notifications';
    case 'screenCapture':
      return 'Screen capture';
    case 'spotterKeyboard':
      return 'Spotter Keyboard';
    case 'textInput':
      return 'Text input';
    default:
      return key;
  }
}

int _capabilityOrder(String key) {
  switch (key) {
    case 'screenCapture':
      return 0;
    case 'accessibilityTree':
      return 1;
    case 'accessibilityActions':
      return 2;
    case 'imeText':
      return 3;
    case 'spotterKeyboard':
      return 4;
    case 'textInput':
      return 5;
    case 'multiTouch':
      return 6;
    case 'displayInfo':
      return 7;
    case 'currentApp':
      return 8;
    case 'notifications':
      return 9;
    default:
      return 100;
  }
}
