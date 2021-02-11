<template>
  <div class="account" v-if="user">
    <section
      style="padding-top: 50px"
      id="about"
      class="section-1 odd highlights image-right"
    >
      <div class="container">
        <div>
        <div class="row d-flex align-items-center">
          <div class="col-2">
            <img class="image-twitter" :src="user.image" />
          </div>
          <div class="col-10 text-left" style="margin-top: 30px">
            <h2 class="mb-0 super effect-static-text">
              @{{ user.screen_name }}
            </h2>
            <h5 style="margin-top: 10px">
              {{ user.name }} - <a href="#" v-on:click="exit">LOGOUT</a>
            </h5>
          </div>
        </div>
        </div>
        <div class="row" style="margin-top: -150px">
          <div
            class="col-12 col-md-6 align-self-center text-center text-md-left"
          >
            <div class="row intro">
              <div class="col-12 p-0"></div>
            </div>
            <div class="row items">
              <div class="col-12 p-0">
                <div class="row item">
                  <div class="col-12 col-md-2 align-self-center">
                    <i class="icon fas fa-chart-line"></i>
                  </div>
                  <div class="col-12 col-md-9 align-self-center">
                    <h6>My Balance</h6>
                    <div class="d-inline-flex justify-content-center">
                      <p>{{ balance }} $LYRA</p>
                    </div>
                  </div>
                </div>
                <div class="row item">
                  <div class="col-12 col-md-2 align-self-center">
                    <i class="icon fab fa-twitter"></i>
                  </div>
                  <div class="col-12 col-md-9 align-self-center">
                    <h6>Account address</h6>
                    <div class="d-inline-flex justify-content-center">
                      <p>{{ user.address }}</p>
                    </div>
                  </div>
                </div>
                <div class="row item" v-if="user.reward_address">
                  <div class="col-12 col-md-2 align-self-center">
                    <i class="icon fas fa-user"></i>
                  </div>
                  <div class="col-12 col-md-9 align-self-center">
                    <h6>Reward address</h6>
                    <div class="d-inline-flex justify-content-center">
                      <p>{{ user.reward_address }}</p>
                      <div style="margin-left: 20px; margin-top: -5px"></div>
                    </div>
                  </div>
                </div>
                <div class="row item">
                  <div class="col-12 col-md-2 align-self-center">
                    <i class="icon fas fa-key"></i>
                  </div>
                  <div class="col-12 col-md-9 align-self-center">
                    <h6>Private Key</h6>
                    <div class="d-inline-flex justify-content-center">
                      <p v-if="user.prv">
                        {{ user.prv.substr(0, 10) }}...{{
                          user.prv.substr(-10)
                        }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-12 col-md-6 hidden-xs">
            <img
              style="margin-top: 30%"
              src="assets/images/twitter_2.png"
              alt="About Us"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
const ScryptaCore = require("@scrypta/core");
export default {
  name: "App",

  data() {
    return {
      isLogged: false,
      user: {},
      balance: 0,
      scrypta: new ScryptaCore(true),
    };
  },
  methods: {
    exit() {
      localStorage.setItem("user", null);
      window.location = "/#/";
    },
  },
  async mounted() {
    const app = this;
    app.scrypta.staticnodes = true;
    window.scrollTo(0, 0);
    if (localStorage.getItem("user") !== null) {
      app.isLogged = true;
      app.user = JSON.parse(localStorage.getItem("user"));
      let b = await app.scrypta.get("/balance/" + app.user.address);
      app.balance = b.balance;
    } else {
      window.location = "/#/";
    }
  },
  components: {},
};
</script>
