import styles from "./ProspectHome.module.css"

const menuItems = [
  { name: "Flat white", note: "A smooth double shot, your way", price: "$4.70", image: "/assets/flat-white.jpg" },
  { name: "Avocado toast", note: "Sourdough, whipped feta, lemon", price: "$14.00", image: "/assets/avocado-toast.jpg" },
  { name: "Butter croissant", note: "Baked fresh each morning", price: "$5.50", image: "/assets/butter-croissant.jpg" },
]

export default function ProspectHome() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="#top" aria-label="QuickTab home">
          <span className={styles.brandMark}>q</span>
          <span>quicktab<span className={styles.brandDot}>.</span></span>
        </a>
        <nav className={styles.nav} aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#cafe">QuickTab Café</a>
          <a className={styles.navCta} href="#get-started">Let’s talk <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span /> A better kind of busy</p>
          <h1>Good service.<br /><em>Less juggling.</em></h1>
          <p className={styles.heroText}>QuickTab helps Australian cafés and small food businesses take orders, get paid and keep the day moving.</p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="#get-started">See what QuickTab can do <span aria-hidden="true">→</span></a>
            <a className={styles.textLink} href="#cafe">Take a look around <span aria-hidden="true">↓</span></a>
          </div>
          <div className={styles.heroNote}><span className={styles.noteIcon}>✳</span><span>Made for the way local places actually work.</span></div>
        </div>
        <div className={styles.heroVisual}>
          <img src="/assets/menu-hero.jpg" alt="Fresh café food and coffee ready to serve" />
          <div className={styles.photoTag}><span className={styles.tagIcon}>↗</span><span><strong>From first scan</strong><br />to ready at the counter</span></div>
          <span className={styles.heroCaption}>A little more breathing room in the rush.</span>
        </div>
      </section>

      <section className={styles.strip} aria-label="QuickTab benefits">
        <span>ORDERING THAT FITS YOUR FLOOR</span><i />
        <span>BUILT FOR INDEPENDENT HOSPITALITY</span><i />
        <span>ONE LESS THING TO CHASE</span>
      </section>

      <section className={styles.how} id="how-it-works">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>The everyday, made easier</p>
          <h2>Small tools.<br /><em>Big difference in the rush.</em></h2>
          <p>QuickTab brings the bits of service that slow you down into one simple flow, from the first order to the last pickup.</p>
        </div>
        <div className={styles.features}>
          <article className={styles.featureCard}>
            <span className={styles.featureNumber}>01</span><span className={styles.featureIcon}>⌗</span>
            <h3>Order at the table</h3><p>Guests scan a table QR code, browse your menu and send an order straight to your team.</p>
            <span className={styles.featureLine} />
          </article>
          <article className={styles.featureCard}>
            <span className={styles.featureNumber}>02</span><span className={styles.featureIcon}>↗</span>
            <h3>Keep orders moving</h3><p>See new orders as they come in, with a clear view for your front-of-house and kitchen team.</p>
            <span className={styles.featureLine} />
          </article>
          <article className={styles.featureCard}>
            <span className={styles.featureNumber}>03</span><span className={styles.featureIcon}>$</span>
            <h3>Make checkout simple</h3><p>Give customers a straightforward way to review their order and pay, without the back-and-forth.</p>
            <span className={styles.featureLine} />
          </article>
        </div>
      </section>

      <section className={styles.showcase} id="cafe">
        <div className={styles.showcaseIntro}>
          <p className={styles.eyebrow}>A real look at the flow</p>
          <h2>Come on in to<br /><em>QuickTab Café.</em></h2>
          <p>We built a working café experience to show how ordering can feel for your guests: welcoming, clear and easy to use on a phone.</p>
          <a className={styles.darkLink} href="#cafe">Explore the café menu <span aria-hidden="true">→</span></a>
          <p className={styles.smallPrint}>Demo menu · sample orders only</p>
        </div>
        <div className={styles.cafeMock}>
          <div className={styles.mockTop}><span><i /> QUICKTAB CAFÉ</span><span>MENU <b>⌕</b></span></div>
          <div className={styles.mockBanner}>
            <img src="/assets/cafe-hero.jpg" alt="The warm interior of QuickTab Café" />
            <div><span>YOUR LOCAL</span><strong>Good things<br />start here.</strong></div>
          </div>
          <div className={styles.mockHeading}><div><small>MADE FRESH, EVERY DAY</small><h3>Today’s favourites</h3></div><span>See all ↗</span></div>
          <div className={styles.mockItems}>{menuItems.map((item) => <article className={styles.mockItem} key={item.name}><img src={item.image} alt="" /><div><strong>{item.name}</strong><small>{item.note}</small><b>{item.price}</b></div><span>+</span></article>)}</div>
          <div className={styles.mockCart}><span>2 items · $18.70</span><strong>View order <span>→</span></strong></div>
          <span className={styles.mockPin}>A menu that feels like yours.</span>
        </div>
      </section>

      <section className={styles.audience}>
        <div><p className={styles.eyebrow}>Made for local hospitality</p><h2>For the places that<br /><em>make a neighbourhood.</em></h2></div>
        <div className={styles.audienceText}><p>From the morning coffee queue to a busy lunch service, QuickTab gives independent operators a practical way to serve guests and stay on top of orders.</p><div className={styles.tags}><span>Cafés</span><span>Takeaway</span><span>Casual dining</span><span>Food trucks</span></div></div>
      </section>

      <section className={styles.contact} id="get-started">
        <div><p className={styles.eyebrow}>Your place, your pace</p><h2>Let’s make the<br /><em>next rush easier.</em></h2></div>
        <div className={styles.contactRight}><p>See how a smoother ordering flow could work for your guests and your team.</p><a href="#cafe" className={styles.lightButton}>Explore the café example <span aria-hidden="true">↗</span></a><small>QuickTab Payments · Built for Australian hospitality</small></div>
      </section>

      <footer className={styles.footer}><a className={styles.brand} href="#top"><span className={styles.brandMark}>q</span><span>quicktab<span className={styles.brandDot}>.</span></span></a><span>Less admin. More good service.</span><a href="#top">Back to top ↑</a></footer>
    </main>
  )
}
