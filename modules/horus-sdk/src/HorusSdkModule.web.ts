import { registerWebModule, NativeModule } from 'expo';

// HorusSdkModule is not available on the web platform.
class HorusSdkModule extends NativeModule<{}> {}

export default registerWebModule(HorusSdkModule, 'HorusSdkModule');
