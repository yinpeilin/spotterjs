import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_companion/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('spotter.mobile_companion/native');

  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          switch (call.method) {
            case 'getState':
              return {
                'running': true,
                'host': '192.168.1.23',
                'port': 17341,
                'pairingCode': '123456',
                'connectedClient': null,
                'manufacturer': 'Google',
                'model': 'Pixel 8',
                'nickname': 'lab-1',
                'accessibilityEnabled': false,
                'inputMethodEnabled': true,
                'inputMethodSelected': true,
                'screenCaptureReady': false,
                'capabilities': {
                  'screenCapture': false,
                  'accessibilityTree': false,
                  'accessibilityActions': false,
                  'imeText': true,
                  'spotterKeyboard': true,
                  'notifications': false,
                },
                'events': ['12:00:00 pairing server started'],
              };
            case 'startPairingServer':
            case 'stopPairingServer':
            case 'regeneratePairingCode':
            case 'openAccessibilitySettings':
            case 'openInputMethodSettings':
            case 'requestScreenCapture':
            case 'setNickname':
              return null;
          }
          throw PlatformException(code: 'unimplemented');
        });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  testWidgets('renders pairing endpoint and code', (tester) async {
    await tester.pumpWidget(const SpotterCompanionApp());
    await tester.pump();

    expect(find.text('Spotter Companion'), findsWidgets);
    expect(find.text('ws://192.168.1.23:17341'), findsOneWidget);
    expect(find.text('123456'), findsOneWidget);
    expect(find.text('lab-1'), findsWidgets);
    expect(find.text('Google Pixel 8'), findsOneWidget);
    expect(find.text('Listening'), findsOneWidget);
    expect(find.text('Start listening'), findsOneWidget);
    expect(find.text('Stop listening'), findsOneWidget);
    expect(find.text('IME text input'), findsWidgets);
    expect(find.text('Spotter Keyboard'), findsWidgets);
  });
}
