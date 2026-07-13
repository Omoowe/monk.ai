import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={s.container}>
        <View style={s.warningIcon} />
        <Text style={s.title}>Something went wrong.</Text>
        <Text style={s.sub}>{this.state.message}</Text>
        <TouchableOpacity
          style={s.btn}
          onPress={() => this.setState({ hasError: false, message: '' })}
        >
          <Text style={s.btnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0a0a0a',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  warningIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#f06060', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  btn: {
    backgroundColor: '#b8f058', borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 32,
  },
  btnText: { fontSize: 14, fontWeight: '700', color: '#0a0a0a' },
});
