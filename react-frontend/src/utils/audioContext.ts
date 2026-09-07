export const sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

export function initAudioContext() {
    if (sharedAudioContext.state === 'suspended') {
        sharedAudioContext.resume().then(() => {
            console.log('AudioContext resumed by user gesture.');
        }).catch(err => {
            console.warn('Failed to resume AudioContext:', err);
        });
    }
}
