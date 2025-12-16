import { useEffect } from 'react';

const Index = () => {
  useEffect(() => {
    // Redirect to the static crypto tracker
    window.location.href = '/crypto/index.html';
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold">Redirecting to CryptoTracker...</h1>
        <p className="text-muted-foreground">
          <a href="/crypto/index.html" className="text-primary underline">
            Click here if not redirected
          </a>
        </p>
      </div>
    </div>
  );
};

export default Index;
