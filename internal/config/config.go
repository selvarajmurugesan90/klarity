package config

import (
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig
	Auth     AuthConfig
	Log      LogConfig
	Clusters []ClusterConfig
}

type ServerConfig struct {
	Port            string
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	ShutdownTimeout time.Duration
	StaticDir       string
	MaxLogLines     int
	SessionTimeout  time.Duration
	DefaultNS       string
	MetricsEnabled  bool
}

type AuthConfig struct {
	Mode         string // none, token, oidc
	OIDC         OIDCConfig
	SkipInsecure bool
}

type OIDCConfig struct {
	IssuerURL    string
	ClientID     string
	ClientSecret string
	RedirectURL  string
	Scopes       []string
}

type LogConfig struct {
	Level  string
	Format string // json, text
}

type ClusterConfig struct {
	Name       string
	Kubeconfig string
	Context    string
}

func Load() (*Config, error) {
	viper.SetEnvPrefix("KD")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()

	viper.SetDefault("server.port", "8080")
	viper.SetDefault("server.readtimeout", "30s")
	viper.SetDefault("server.writetimeout", "120s")
	viper.SetDefault("server.shutdowntimeout", "15s")
	viper.SetDefault("server.maxloglines", 10000)
	viper.SetDefault("server.sessiontimeout", "24h")
	viper.SetDefault("server.defaultns", "default")
	viper.SetDefault("server.metricsenabled", true)

	viper.SetDefault("auth.mode", "internal")
	viper.SetDefault("auth.skipinsecure", false)
	viper.SetDefault("auth.oidc.scopes", []string{"openid", "profile", "email"})

	viper.SetDefault("log.level", "info")
	viper.SetDefault("log.format", "json")

	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("/etc/klarity")
	viper.AddConfigPath(".")
	_ = viper.ReadInConfig()

	cfg := &Config{}

	cfg.Server = ServerConfig{
		Port:            viper.GetString("server.port"),
		ReadTimeout:     viper.GetDuration("server.readtimeout"),
		WriteTimeout:    viper.GetDuration("server.writetimeout"),
		ShutdownTimeout: viper.GetDuration("server.shutdowntimeout"),
		MaxLogLines:     viper.GetInt("server.maxloglines"),
		SessionTimeout:  viper.GetDuration("server.sessiontimeout"),
		DefaultNS:       viper.GetString("server.defaultns"),
		MetricsEnabled:  viper.GetBool("server.metricsenabled"),
	}

	cfg.Auth = AuthConfig{
		Mode:         viper.GetString("auth.mode"),
		SkipInsecure: viper.GetBool("auth.skipinsecure"),
		OIDC: OIDCConfig{
			IssuerURL:    viper.GetString("auth.oidc.issuerurl"),
			ClientID:     viper.GetString("auth.oidc.clientid"),
			ClientSecret: viper.GetString("auth.oidc.clientsecret"),
			RedirectURL:  viper.GetString("auth.oidc.redirecturl"),
			Scopes:       viper.GetStringSlice("auth.oidc.scopes"),
		},
	}

	cfg.Log = LogConfig{
		Level:  viper.GetString("log.level"),
		Format: viper.GetString("log.format"),
	}

	return cfg, nil
}

func SetupLogger(cfg LogConfig) *logrus.Logger {
	log := logrus.New()
	level, err := logrus.ParseLevel(cfg.Level)
	if err != nil {
		level = logrus.InfoLevel
	}
	log.SetLevel(level)
	if cfg.Format == "json" {
		log.SetFormatter(&logrus.JSONFormatter{})
	} else {
		log.SetFormatter(&logrus.TextFormatter{FullTimestamp: true})
	}
	return log
}
