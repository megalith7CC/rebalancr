interface Window {
  ethereum: {
    isMetaMask?: boolean;
    on: (event: string, callback: (...args: any[]) => void) => void;
    request: (request: { method: string; params?: any[] }) => Promise<any>;
    send: (method: string, params: any[]) => Promise<any>;
  };
}
