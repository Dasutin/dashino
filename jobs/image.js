const images = [
  {
    url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1400&q=80',
    caption: 'City at dusk',
    fit: 'cover'
  },
  {
    url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80',
    caption: 'Hiking trip',
    fit: 'cover'
  },
  {
    url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1400&q=80',
    caption: 'Upstate forest',
    fit: 'cover'
  },
  {
    url: 'https://images.unsplash.com/photo-1458668383970-8ddd3927deed?auto=format&fit=crop&w=1400&q=80',
    caption: 'Mountains',
    fit: 'cover'
  },
  {
    url: 'https://images.unsplash.com/photo-1482192505345-5655af888cc4?auto=format&fit=crop&w=1400&q=80',
    caption: 'Cabin on the lake',
    fit: 'cover'
  },
  {
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1400&q=80',
    caption: 'Earth from space at night',
    fit: 'cover'
  },
  {
    url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1400&q=80',
    caption: 'Winter sky',
    fit: 'cover'
  },
  {
    url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80',
    caption: 'Boating on the lake',
    fit: 'cover'
  }
];

function sample(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export default {
  interval: 15000,
  widgetId: 'image',
  type: 'image',
  run: emit => {
    const pick = sample(images);
    emit({ widgetId: 'image', type: 'image', data: pick });
  }
};