console.log("Service Worker Loaded...");

self.addEventListener("push", e => {
  const data = e.data.json();
  self.registration.showNotification(data.title, {
    body: "On offer just at "+data.price,
    icon: data.prodimg
  });
});
