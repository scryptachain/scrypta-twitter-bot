<template>
  <div class="endorsements">
    <div class="home theme-mode-dark">
      <!-- Header -->
      <header id="header">
        <!-- Navbar -->
        <nav class="navbar navbar-expand">
          <div class="container header">
            <!-- Navbar Brand-->
            <a class="navbar-brand" href="/">
              <img src="assets/images/logo_white.svg" alt="Scrypta" />
            </a>
            <!-- Nav holder -->
            <div class="ml-auto"></div>
            <!-- Navbar Items -->
            <ul class="navbar-nav items">
              <li class="nav-item">
                  <router-link to="/" class="nav-link smooth-anchor">Home</router-link>
              </li>
              <li class="nav-item">
                <router-link to="/tips" class="nav-link smooth-anchor">All tips</router-link>
              </li>
            </ul>
            <!-- Navbar Icons -->
            <ul class="navbar-nav icons">
              <li class="nav-item social">
                <a
                  href="https://twitter.com/scryptachain"
                  target="_blank"
                  class="nav-link"
                  ><i class="icon-social-twitter ml-0"></i
                ></a>
              </li>
              <li class="nav-item">
                <a
                  href="https://github.com/scryptachain/"
                  target="_blank"
                  class="nav-link"
                  ><i class="fab fa-github"></i
                ></a>
              </li>
              <li class="nav-item">
                <a
                  href="https://t.me/scryptachain_official"
                  target="_blank"
                  class="nav-link"
                  ><i class="fab fa-telegram"></i
                ></a>
              </li>
              <li class="nav-item">
                <a href="https://scrypta.wiki" target="_blank" class="nav-link"
                  ><i class="fab fa-wikipedia-w"></i
                ></a>
              </li>
              <li class="nav-item">
                <a
                  href="https://discord.gg/8mfDRVK"
                  target="_blank"
                  class="nav-link"
                  ><i class="fab fa-discord"></i
                ></a>
              </li>
            </ul>
            <!-- Navbar Toggle -->
            <ul class="navbar-nav toggle">
              <li class="nav-item">
                <a
                  href="#"
                  class="nav-link"
                  data-toggle="modal"
                  data-target="#menu"
                >
                  <i class="icon-menu m-0"></i>
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </header>
      <!-- Hero -->
      <section id="slider" class="section-1 hero p-0 odd">
        <div class="swiper-container no-slider featured animation slider-h-70">
          <div class="swiper-wrapper">
            <img
              src="assets/images/icon_twtt.svg"
              style="height: 400px"
              class="hero-image upper"
              alt="Twitter Bot"
            />
            <!-- Item 1 -->
            <div class="swiper-slide slide-center">
              <div class="slide-content row" data-mask-768="50">
                <div class="col-12 d-flex inner">
                  <div class="left align-self-center text-center text-md-left">
                    <h1 class="title effect-static-text">
                      Explore<br />all Endorsers.
                    </h1>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <!-- Features -->
      <section id="features" class="section-2 offers featured">
        <div class="container">
          <div class="justify-content-center text-center items">
            <Endorser />
          </div>
        </div>
      </section>
      <!-- Footer -->
      <footer class="odd">
        <!-- Footer [links] -->
        <section id="footer" class="footer">
          <div class="container">
            <div class="row items footer-widget">
              <div class="col-12 col-lg-3 p-0">
                <div class="row">
                  <div
                    class="branding col-12 p-3 text-center text-lg-left item"
                  >
                    <div class="brand">
                      <a href="/" class="logo">
                        <img src="assets/images/logo_white.svg" alt="Scrypta" />
                      </a>
                    </div>
                    <p>
                      Scrypta Twitter Bot is an open-source project by Scrypta
                      Foundation
                    </p>
                    <ul class="navbar-nav social share-list mt-0 ml-auto">
                      <li class="nav-item">
                        <a
                          href="https://twitter.com/scryptachain"
                          target="_blank"
                          class="nav-link"
                          ><i class="icon-social-twitter ml-0"></i
                        ></a>
                      </li>
                      <li class="nav-item">
                        <a
                          href="https://github.com/scryptachain/"
                          target="_blank"
                          class="nav-link"
                          ><i class="fab fa-github"></i
                        ></a>
                      </li>
                      <li class="nav-item">
                        <a
                          href="https://t.me/scryptachain_official"
                          target="_blank"
                          class="nav-link"
                          ><i class="fab fa-telegram"></i
                        ></a>
                      </li>
                      <li class="nav-item">
                        <a href="#" class="nav-link"
                          ><i class="fab fa-wikipedia-w"></i
                        ></a>
                      </li>
                      <li class="nav-item">
                        <a
                          href="https://discord.gg/8mfDRVK"
                          target="_blank"
                          class="nav-link"
                          ><i class="fab fa-discord"></i
                        ></a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div class="col-12 col-lg-9 p-0">
                <div class="row">
                  <div
                    class="col-12 col-lg-4 p-3 text-center text-lg-left item"
                  ></div>
                  <div
                    class="col-12 col-lg-4 p-3 text-center text-lg-left item"
                  ></div>
                  <div
                    class="col-12 col-lg-4 p-3 text-center text-lg-right item"
                  >
                    <h6 class="title">Official Websites</h6>
                    <ul class="navbar-nav">
                      <li class="nav-item">
                        <a
                          href="https://scryptachain.org/"
                          target="_blank"
                          class="nav-link"
                        >
                          Scrypta Blockchain
                        </a>
                      </li>
                      <li class="nav-item">
                        <a
                          href="http://scrypta.foundation/"
                          target="_blank"
                          class="nav-link"
                        >
                          Scrypta Foundation
                        </a>
                      </li>
                      <li class="nav-item">
                        <a
                          href="http://scryptaconsortium.org/"
                          target="_blank"
                          class="nav-link"
                        >
                          Scrypta Consortium
                        </a>
                      </li>
                      <li class="nav-item">
                        <a
                          href="https://bb.scryptachain.org/"
                          target="_blank"
                          class="nav-link"
                        >
                          Block Explorer
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Copyright -->
        <section id="copyright" class="p-3 copyright">
          <div class="container">
            <div class="row">
              <div class="col-12 col-md-6 p-3 text-center text-lg-left">
                <p>
                  Scrypta Twitter Bot is an open source project running on
                  Scrypta Blockchain.
                </p>
                <!--
                                Suggestion: Replace the text above with a description of your website.
                             -->
              </div>
              <div class="col-12 col-md-6 p-3 text-center text-lg-right">
                <p>
                  © 2021 Powered by
                  <a href="https://scrypta.foundation" target="_blank"
                    >Scrypta Foundation</a
                  >.
                </p>
              </div>
            </div>
          </div>
        </section>
      </footer>

      <!-- Modal [responsive menu] -->
      <div
        id="menu"
        class="p-0 modal fade"
        role="dialog"
        aria-labelledby="menu"
        aria-hidden="true"
      >
        <div class="modal-dialog modal-dialog-slideout" role="document">
          <div class="modal-content full">
            <div class="modal-header" data-dismiss="modal">
              Menu <i class="icon-close"></i>
            </div>
            <div class="menu modal-body">
              <div class="row w-100">
                <div class="items p-0 col-12 text-center">
                  <!-- Append [navbar] -->
                </div>
                <div class="contacts p-0 col-12 text-center">
                  <!-- Append [navbar] -->
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Endorser from "../components/Endorser.vue";
export default {
  name: "endorments",
  components: {
    Endorser,
  },

  data() {
    return {};
  },
};
</script>